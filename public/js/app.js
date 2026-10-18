// public/js/app.js - SPA Giriş Noktası ve Yönlendirici (Orchestrator)
import { store } from "./state/store.js";
import { apiClient } from "./api/apiClient.js";
import { RouteGuard } from "./guards/routeGuard.js";
import { toast } from "./components/Toast.js";
import { HomeScanView } from "./views/HomeScanView.js";
import { AuthView } from "./views/AuthView.js";
import { ProfileWizardView } from "./views/ProfileWizardView.js";
import { ChatView } from "./views/ChatView.js";
import { AdminView } from "./views/AdminView.js";

class Application {
  constructor() {
    this.mainContainer = document.getElementById("mainAppContainer");
    this.navContainer = document.getElementById("navLinksContainer");
    this.currentViewInstance = null;

    // 401 Durumunda Otomatik Oturum Temizleme ve Yönlendirme (Adapter Entegrasyonu)
    apiClient.onUnauthorized = () => {
      store.clearAuth();
      this.navigate("auth");
      toast.info("Oturum süreniz doldu. Lütfen tekrar giriş yapınız.");
    };

    // Global Durum Değişikliklerini Dinle (Observer Pattern)
    store.subscribe(() => {
      this.updateNavigation();
    });
  }

  init() {
    this.updateNavigation();
    this.navigate("home");

    // Tarayıcı Geri/İleri Buton Desteği (Hashchange)
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace("#", "") || "home";
      this.navigate(hash);
    });
  }

  navigate(viewName) {
    // Route Guard Kontrolü
    const allowedView = RouteGuard.canActivate(viewName);

    if (window.location.hash !== `#${allowedView}`) {
      window.location.hash = `#${allowedView}`;
    }

    if (this.currentViewInstance && typeof this.currentViewInstance.destroy === "function") {
      this.currentViewInstance.destroy();
    }

    store.setState({ currentView: allowedView });
    this.renderView(allowedView);
  }

  renderView(viewName) {
    this.mainContainer.innerHTML = "";

    switch (viewName) {
      case "home":
        this.currentViewInstance = new HomeScanView(this.mainContainer);
        this.currentViewInstance.render();
        break;
      case "auth":
      case "verify":
        this.currentViewInstance = new AuthView(this.mainContainer, (v) => this.navigate(v));
        if (viewName === "verify") this.currentViewInstance.setMode("verify");
        this.currentViewInstance.render();
        break;
      case "profile":
        this.currentViewInstance = new ProfileWizardView(this.mainContainer, (v) => this.navigate(v));
        this.currentViewInstance.loadInitialData();
        break;
      case "chat":
        this.currentViewInstance = new ChatView(this.mainContainer);
        this.currentViewInstance.render();
        break;
      case "admin":
        this.currentViewInstance = new AdminView(this.mainContainer);
        this.currentViewInstance.render();
        break;
      default:
        this.navigate("home");
        break;
    }
  }

  updateNavigation() {
    if (!this.navContainer) return;
    this.navContainer.innerHTML = "";

    const isAuth = store.isAuthenticated();
    const isAdmin = store.isAdmin();
    const currentView = store.getState().currentView;

    // 1. Ürün Tara
    const scanLink = this.createNavLink("Ürün Tara", "home", currentView === "home");
    this.navContainer.appendChild(scanLink);

    // 2. AI Asistanı
    const chatLink = this.createNavLink("AI Danışman", "chat", currentView === "chat");
    this.navContainer.appendChild(chatLink);

    // 3. Kullanıcı Durumuna Göre Linkler
    if (isAuth) {
      const profileLink = this.createNavLink("Cilt Profilim", "profile", currentView === "profile");
      this.navContainer.appendChild(profileLink);

      // Yalnızca Admin rolünde olanlara Yönetici linki gösterilir
      if (isAdmin) {
        const adminLink = this.createNavLink("🛡️ Yönetici", "admin", currentView === "admin");
        adminLink.style.color = "var(--color-danger)";
        this.navContainer.appendChild(adminLink);
      }

      const logoutBtn = document.createElement("button");
      logoutBtn.className = "btn btn-sm btn-outline";
      logoutBtn.textContent = "Çıkış Yap";
      logoutBtn.onclick = () => {
        store.clearAuth();
        toast.info("Oturum kapatıldı.");
        this.navigate("home");
      };
      this.navContainer.appendChild(logoutBtn);
    } else {
      const authLink = this.createNavLink("Giriş / Kayıt", "auth", currentView === "auth" || currentView === "verify");
      this.navContainer.appendChild(authLink);
    }
  }

  createNavLink(label, targetView, isActive) {
    const a = document.createElement("a");
    a.href = `#${targetView}`;
    a.className = `nav-link ${isActive ? "active" : ""}`;
    a.textContent = label;
    a.onclick = (e) => {
      e.preventDefault();
      this.navigate(targetView);
    };
    return a;
  }
}

// Uygulamayı Başlat
document.addEventListener("DOMContentLoaded", () => {
  const app = new Application();
  app.init();
});
