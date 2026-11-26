// src/modules/community/presentation/routes/communityRoutes.js - Community Uç Noktaları
const { Router } = require("express");

function createCommunityRoutes(contributionController, authMiddleware = null, adminMiddleware = null) {
  const router = Router();

  // Katkı Gönderme (Oturum Açmış Kullanıcı)
  if (authMiddleware) {
    router.post("/contributions", authMiddleware, contributionController.submit);
  } else {
    router.post("/contributions", contributionController.submit);
  }

  // Moderasyon Uç Noktaları (YALNIZCA YÖNETİCİ).
  // Önceden hiçbir middleware yoktu: kimliksiz bir istemci bekleyen katkıları
  // listeleyebiliyor, onaylayıp kataloğa ürün yazabiliyor ve puan dağıtabiliyordu.
  const moderationGuards = [authMiddleware, adminMiddleware].filter(Boolean);
  router.get("/contributions/pending", ...moderationGuards, contributionController.listPending);
  router.post("/contributions/:id/approve", ...moderationGuards, contributionController.approve);
  router.post("/contributions/:id/reject", ...moderationGuards, contributionController.reject);

  // Hatalı İçerik Bildirme (+20 Puan).
  // authMiddleware olmadan req.user hiç dolmuyordu; bildirim userId: null ile
  // kaydediliyor ve vadedilen 20 puan hiçbir hesaba yazılamıyordu.
  if (authMiddleware) {
    router.post("/community/report-issue", authMiddleware, contributionController.reportIssue);
  } else {
    router.post("/community/report-issue", contributionController.reportIssue);
  }

  return router;
}

module.exports = createCommunityRoutes;
