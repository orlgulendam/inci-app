// src/modules/community/presentation/routes/communityRoutes.js - Community Uç Noktaları
const { Router } = require("express");

function createCommunityRoutes(contributionController, authMiddleware = null) {
  const router = Router();

  // Katkı Gönderme (Oturum Açmış Kullanıcı)
  if (authMiddleware) {
    router.post("/contributions", authMiddleware, contributionController.submit);
  } else {
    router.post("/contributions", contributionController.submit);
  }

  // Moderasyon Uç Noktaları
  router.get("/contributions/pending", contributionController.listPending);
  router.post("/contributions/:id/approve", contributionController.approve);
  router.post("/contributions/:id/reject", contributionController.reject);

  return router;
}

module.exports = createCommunityRoutes;
