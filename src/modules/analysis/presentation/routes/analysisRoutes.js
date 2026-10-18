// src/modules/analysis/presentation/routes/analysisRoutes.js - Express Yönlendirici
const { Router } = require("express");

function createAnalysisRoutes(analysisController) {
  const router = Router();

  // POST /api/v1/analyze
  router.post("/analyze", analysisController.analyzeText);

  // GET /api/v1/ingredients/search?q=niacinamide
  router.get("/ingredients/search", analysisController.searchIngredients);

  // GET /api/v1/ingredients/:inci
  router.get("/ingredients/:inci", analysisController.getIngredientByInci);

  return router;
}

module.exports = createAnalysisRoutes;
