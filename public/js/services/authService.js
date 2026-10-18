// public/js/services/authService.js - Kimlik Yönetim Servisi (SRP & DIP)
// Gerekçe: Kimlik doğrulama, e-posta onaylama ve şifre sıfırlama iş akışlarını koordine etmek için.
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";
import { store } from "../state/store.js";

export class AuthService {
  constructor(client = apiClient, appStore = store) {
    this.client = client;
    this.store = appStore;
  }

  async register({ email, password, firstName, lastName }) {
    const res = await this.client.post(ENDPOINTS.AUTH_REGISTER, {
      email,
      password,
      firstName,
      lastName
    });
    return res.data;
  }

  async login({ email, password }) {
    const res = await this.client.post(ENDPOINTS.AUTH_LOGIN, { email, password });
    if (res.data && res.data.token) {
      this.store.setAuth({
        token: res.data.token,
        user: res.data.user
      });
    }
    return res.data;
  }

  logout() {
    this.store.clearAuth();
  }

  async verifyEmail(token) {
    const res = await this.client.get(ENDPOINTS.AUTH_VERIFY_EMAIL(token));
    // Başarılı doğrulama sonrası kullanıcı durumunu güncelle
    const currentUser = this.store.getState().user;
    if (currentUser) {
      this.store.setState({
        user: { ...currentUser, isEmailVerified: true }
      });
    }
    return res.data;
  }

  async resendVerification(email) {
    const res = await this.client.post(ENDPOINTS.AUTH_RESEND_VERIFICATION, { email });
    return res.data;
  }

  async forgotPassword(email) {
    const res = await this.client.post(ENDPOINTS.AUTH_FORGOT_PASSWORD, { email });
    return res.data;
  }

  async resetPassword({ token, newPassword }) {
    const res = await this.client.post(ENDPOINTS.AUTH_RESET_PASSWORD, { token, newPassword });
    return res.data;
  }
}

export const authService = new AuthService();
