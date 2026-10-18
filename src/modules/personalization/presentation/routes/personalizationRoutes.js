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

