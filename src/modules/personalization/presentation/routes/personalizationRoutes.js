// src/modules/personalization/presentation/routes/personalizationRoutes.js - Express Yönlendirici
const { Router } = require("express");

function createPersonalizationRoutes({
  authController,
  profileController,
  adminController,
  chatController,
  authMiddleware,
  adminMiddleware
}) {
  const router = Router();

  // Açık Kimlik Doğrulama Uç Noktaları
  router.post("/auth/register", authController.register);
  router.post("/auth/login", authController.login);
  router.get("/auth/verify-email/:token", authController.verifyEmail);
  router.get("/auth/verify-email", authController.verifyEmail);
  router.post("/auth/resend-verification", authController.resendVerification);
  router.post("/auth/forgot-password", authController.forgotPassword);
  router.post("/auth/reset-password", authController.resetPassword);

  // Cilt Uyumluluğu Testi (Açık veya Token ile)
  router.post("/profile/check-compatibility", (req, res, next) => {
    // İsteğe bağlı token kontrolü
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authMiddleware(req, res, next);
    }
    next();
  }, profileController.checkCompatibility);

  // Korumalı Profil Uç Noktaları (JWT Zorunlu)
  router.get("/profile/skin", authMiddleware, profileController.getProfile);
  router.put("/profile/skin", authMiddleware, profileController.updateProfile);
  // Apple App Store Guideline 5.1.1 Gereği Hesap Silme Uç Noktası
  router.delete("/profile/account", authMiddleware, profileController.deleteAccount);

  // Cilt Rutini Uç Noktaları (Sabah & Akşam)
  router.get("/personalization/routine", authMiddleware, profileController.getRoutine);
  router.put("/personalization/routine", authMiddleware, profileController.updateRoutine);
  router.post("/personalization/routine/complete-step", authMiddleware, profileController.completeRoutine);

  // Dijital Cilt Bakım Dolabı & PAO / SKT Uç Noktaları
  router.get("/personalization/vanity", authMiddleware, profileController.getVanity);
  router.post("/personalization/vanity", authMiddleware, profileController.addVanityItem);
  router.delete("/personalization/vanity/:id", authMiddleware, profileController.removeVanityItem);

  // 7 Günlük İnci İstiridyesi Sandığı (Mystery Loot Box)
  router.post("/personalization/chest/claim", authMiddleware, profileController.claimOysterChest);


  // AI Danışmanlık ve Sohbet Uç Noktası (Token opsiyonel: Giriş yapmışsa profiliyle yanıtlar)
  if (chatController) {
    router.post("/chat", (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        return authMiddleware(req, res, next);
      }
      next();
    }, chatController.sendMessage);
  }

  // Yönetici (Admin) Uç Noktaları (Yalnızca Admin Rolü)
  if (adminController && adminMiddleware) {
    router.get("/admin/users", authMiddleware, adminMiddleware, adminController.getUsers);
    router.get("/admin/scan-logs", authMiddleware, adminMiddleware, adminController.getScanLogs);
  }

  return router;
}

module.exports = createPersonalizationRoutes;

