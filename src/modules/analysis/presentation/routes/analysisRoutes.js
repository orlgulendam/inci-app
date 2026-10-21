// src/modules/analysis/presentation/routes/analysisRoutes.js - Express Yönlendirici
const { Router } = require("express");
const httpCache = require("../../../../core/middlewares/httpCache");

function createAnalysisRoutes(analysisController) {
  const router = Router();

  // POST /api/v1/analyze (İşlemsel, önbelleklenemez)
  router.post("/analyze", analysisController.analyzeText);

  // GET /api/v1/ingredients/search?q=niacinamide&fields=inci,cosingRefNo
  router.get(
    "/ingredients/search",
    httpCache({ maxAge: 1800, staleWhileRevalidate: 43200, isPublic: true }),
    analysisController.searchIngredients
  );

  // GET /api/v1/ingredients/:inci (Statik sözlük verisi, 24 saat önbellek)
  router.get(
    "/ingredients/:inci",
    httpCache({ maxAge: 86400, staleWhileRevalidate: 604800, isPublic: true }),
    analysisController.getIngredientByInci
  );

  return router;
}

module.exports = createAnalysisRoutes;
