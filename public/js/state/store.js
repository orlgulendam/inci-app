// public/js/state/store.js - Global Durum Yönetimi (Observer Pattern)
// Gerekçe: Oturum, profil ve görünüm durumlarındaki değişiklikleri UI bileşenlerine gevşek bağlı (loose coupling) şekilde duyurmak için.

class Store {
  constructor() {
    const savedToken = Store.readStored("inci_token");
    let savedUser = null;
    try {
      const rawUser = Store.readStored("inci_user");
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

  /**
   * Oturum verisi hem localStorage hem sessionStorage icine yazilir.
   * Yalnizca sessionStorage kullanildiginda mobil uygulama (WebView) kapaninca
   * oturum siliniyor ve kullanici her acilista yeniden giris yapmak zorunda kaliyordu.
   * Ozel pencere / kisitli depolama durumunda her erisim try/catch ile korunur.
   */
  static readStored(key) {
    try {
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) return fromLocal;
    } catch (_) {}
    try {
      return sessionStorage.getItem(key) || null;
    } catch (_) {
      return null;
    }
  }

  static writeStored(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }

  static removeStored(key) {
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
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
      Store.writeStored("inci_token", token);
    } else {
      Store.removeStored("inci_token");
    }

    if (user) {
      Store.writeStored("inci_user", JSON.stringify(user));
    } else {
      Store.removeStored("inci_user");
    }

    this.setState({ token, user });
  }

  clearAuth() {
    Store.removeStored("inci_token");
    Store.removeStored("inci_user");
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
