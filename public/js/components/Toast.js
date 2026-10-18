// public/js/components/Toast.js - Kullanıcı Geri Bildirim Bildirimleri (SRP)
// Gerekçe: Kullanıcıya geçici başarı, hata ve bilgi mesajlarını XSS güvenli biçimde sunmak.

class ToastManager {
  constructor() {
    this.container = null;
  }

  ensureContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.createElement("div");
      this.container.className = "toast-container";
      this.container.setAttribute("aria-live", "polite");
      document.body.appendChild(this.container);
    }
  }

  show(message, type = "info", durationMs = 4000) {
    this.ensureContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");

    // XSS Güvenliği: innerHTML yerine textContent kullanılır
    const textNode = document.createElement("span");
    textNode.textContent = message;
    toast.appendChild(textNode);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.className = "btn btn-sm btn-outline";
    closeBtn.style.color = "#fff";
    closeBtn.style.border = "none";
    closeBtn.style.padding = "0 4px";
    closeBtn.setAttribute("aria-label", "Kapat");
    closeBtn.onclick = () => {
      toast.remove();
    };
    toast.appendChild(closeBtn);

    this.container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, durationMs);
  }

  success(msg) { this.show(msg, "success"); }
  error(msg) { this.show(msg, "error", 5000); }
  info(msg) { this.show(msg, "info"); }
}

export const toast = new ToastManager();
