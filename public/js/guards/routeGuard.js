// public/js/guards/routeGuard.js - İstemci Yönlendirme Muhafızı (Route Guard Pattern)
// Gerekçe: Kullanıcı deneyimini korumak, yetkisiz veya doğrulanmamış kullanıcıları uygun sayfalara yönlendirmek için (UX Guard).
import { store } from "../state/store.js";
import { toast } from "../components/Toast.js";

export class RouteGuard {
  /**
   * Hedef görünüme geçilip geçilemeyeceğini denetler
   * @param {string} targetView - "home" | "profile" | "chat" | "admin" | "auth" | "verify"
   * @returns {string} - İzin verilen veya yönlendirilen görünüm adı
   */
  static canActivate(targetView) {
    const isAuth = store.isAuthenticated();
    const isEmailVerified = store.isEmailVerified();
    const isAdmin = store.isAdmin();

    // 1. Yönetici Paneli Koruması
    if (targetView === "admin") {
      if (!isAuth) {
        toast.error("Yönetici paneline erişmek için oturum açmalısınız.");
        return "auth";
      }
      if (!isAdmin) {
        toast.error("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
        return "home";
      }
      return "admin";
    }

    // 2. Korumalı Kullanıcı Sayfaları (Profil ve Sohbet)
    if (targetView === "profile") {
      if (!isAuth) {
        toast.info("Profilinizi görüntülemek ve düzenlemek için lütfen giriş yapınız.");
        return "auth";
      }
      // E-posta doğrulanmamışsa uyarı ile doğrulama ekranına yönlendir
      if (!isEmailVerified) {
        toast.info("Lütfen profilinize devam etmeden önce e-posta adresinizi doğrulayınız.");
        return "verify";
      }
      return "profile";
    }

    // 3. Zaten giriş yapmış kullanıcının login/register sayfasına gitmesi durumu
    if (targetView === "auth" && isAuth) {
      return "home";
    }

    return targetView;
  }
}
