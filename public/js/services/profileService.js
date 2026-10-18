// public/js/services/profileService.js - Cilt Profili Yönetim Servisi (SRP & DIP)
// Gerekçe: Kullanıcının cilt profili, alerjenleri, rutini ve dermatolog notlarını yönetmek için.
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";
import { store } from "../state/store.js";

export class ProfileService {
  constructor(client = apiClient, appStore = store) {
    this.client = client;
    this.store = appStore;
  }

  async getProfile() {
    const res = await this.client.get(ENDPOINTS.PROFILE_SKIN);
    if (res.data) {
      this.store.setState({ skinProfile: res.data.skinProfile });
    }
    return res.data;
  }

  async updateProfile(profileData) {
    const res = await this.client.put(ENDPOINTS.PROFILE_SKIN, profileData);
    if (res.data) {
      this.store.setState({
        skinProfile: res.data.skinProfile,
        user: {
          ...this.store.getState().user,
          firstName: res.data.firstName,
          lastName: res.data.lastName
        }
      });
    }
  async deleteAccount() {
    const res = await this.client.delete(ENDPOINTS.PROFILE_DELETE_ACCOUNT);
    this.store.clearAuth();
    return res.data;
  }
}

export const profileService = new ProfileService();

