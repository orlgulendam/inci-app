// public/js/state/store.js - Global Durum Yönetimi (Observer Pattern)
// Gerekçe: Oturum, profil ve görünüm durumlarındaki değişiklikleri UI bileşenlerine gevşek bağlı (loose coupling) şekilde duyurmak için.

class Store {
  constructor() {
    const savedToken = sessionStorage.getItem("inci_token") || null;
    let savedUser = null;
    try {
      const rawUser = sessionStorage.getItem("inci_user");
      if (rawUser) savedUser = JSON.parse(rawUser);
    } catch (_) {}

    this.state = {
      token: savedToken,
      user: savedUser,
      skinProfile: null,
      currentView: "home",
      viewParams: null,
      isLoading: false
    };

    this.listeners = new Set();
  }

  getState() {
    return { ...this.state };
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    // Dinlemeyi bırakma fonksiyonu (Unsubscribe) döner
    return () => this.listeners.delete(listener);
  }

  notify() {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch (err) {
        console.error("Store listener execution error:", err);
      }
    }
  }

  setAuth({ token, user }) {
    if (token) {
      sessionStorage.setItem("inci_token", token);
    } else {
      sessionStorage.removeItem("inci_token");
    }

    if (user) {
      sessionStorage.setItem("inci_user", JSON.stringify(user));
    } else {
      sessionStorage.removeItem("inci_user");
    }

    this.setState({ token, user });
  }

  clearAuth() {
    sessionStorage.removeItem("inci_token");
    sessionStorage.removeItem("inci_user");
    this.setState({ token: null, user: null, skinProfile: null });
  }

  isAuthenticated() {
    return !!this.state.token;
  }

  isAdmin() {
    return this.state.user && this.state.user.role === "admin";
  }

  isEmailVerified() {
    return this.state.user && !!this.state.user.isEmailVerified;
  }
}

export const store = new Store();
