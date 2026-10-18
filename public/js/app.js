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
    const bottomNav = document.getElementById("mobileBottomNav");
    if (!bottomNav) return;
    bottomNav.innerHTML = "";

    const isAuth = store.isAuthenticated();
    const isAdmin = store.isAdmin();
    const currentView = store.getState().currentView;

    // 1. Keşfet Tab
    bottomNav.appendChild(this.createBottomNavItem({
      label: "Keşfet",
      icon: "🏠",
      targetView: "home",
      isActive: currentView === "home"
    }));

    // 2. Tara Tab (Merkezdeki Büyük Pembe Buton)
    const scanTab = document.createElement("button");
    scanTab.className = `bottom-nav-item center-action ${currentView === "scan" ? "active" : ""}`;
    scanTab.setAttribute("aria-label", "Barkod Tara");
    scanTab.innerHTML = `
      <div class="nav-icon-circle">📷</div>
      <span>Tara</span>
    `;
    scanTab.onclick = () => {
      this.navigate("home");
      // Eğer Home görünümündeyse doğrudan kamera modalını aç
      if (this.currentViewInstance && typeof this.currentViewInstance.openCameraModal === "function") {
        this.currentViewInstance.openCameraModal();
      }
    };
    bottomNav.appendChild(scanTab);

    // 3. Asistan Tab
    bottomNav.appendChild(this.createBottomNavItem({
      label: "Asistan",
      icon: "💬",
      targetView: "chat",
      isActive: currentView === "chat"
    }));

    // 4. Profil Tab
    bottomNav.appendChild(this.createBottomNavItem({
      label: "Profil",
      icon: "👤",
      targetView: isAuth ? "profile" : "auth",
      isActive: currentView === "profile" || currentView === "auth"
    }));

    // 5. Admin / Ayarlar Tab
    bottomNav.appendChild(this.createBottomNavItem({
      label: isAdmin ? "Admin" : "Ayarlar",
      icon: isAdmin ? "🛡️" : "⚙️",
      targetView: isAdmin ? "admin" : (isAuth ? "profile" : "auth"),
      isActive: currentView === "admin"
    }));

    // Üst Header Hızlı Durum (Giriş/Çıkış rozeti)
    const quickStatus = document.getElementById("headerQuickStatus");
    if (quickStatus) {
      quickStatus.innerHTML = "";
      if (isAuth) {
        const user = store.getState().user;
        const badge = document.createElement("button");
        badge.className = "btn btn-sm btn-outline";
        badge.style.fontSize = "11px";
        badge.textContent = `Çıkış (${user?.firstName || "Hesabım"})`;
        badge.onclick = () => {
          store.clearAuth();
          toast.info("Oturum kapatıldı.");
          this.navigate("home");
        };
        quickStatus.appendChild(badge);
      }
    }
  }

  createBottomNavItem({ label, icon, targetView, isActive }) {
    const btn = document.createElement("button");
    btn.className = `bottom-nav-item ${isActive ? "active" : ""}`;
    btn.innerHTML = `
      <span class="nav-icon">${icon}</span>
      <span>${label}</span>
    `;
    btn.onclick = () => this.navigate(targetView);
    return btn;
  }
}

// Uygulamayı Başlat
document.addEventListener("DOMContentLoaded", () => {
  const app = new Application();
  app.init();
});
