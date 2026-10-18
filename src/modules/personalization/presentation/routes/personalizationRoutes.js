// src/modules/personalization/presentation/routes/personalizationRoutes.js - Express Yönlendirici
const { Router } = require("express");

function createPersonalizationRoutes(authController, profileController, authMiddleware) {
  const router = Router();

  // Açık Kimlik Doğrulama Uç Noktaları
  router.post("/auth/register", authController.register);
  router.post("/auth/login", authController.login);

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

  return router;
}

module.exports = createPersonalizationRoutes;
