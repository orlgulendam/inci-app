// src/modules/analysis/index.js - Analysis Modülü Giriş Noktası
const MongoIngredientRepository = require("./infrastructure/repositories/MongoIngredientRepository");
const AnalysisService = require("./application/services/AnalysisService");
const AnalysisController = require("./presentation/controllers/AnalysisController");
const createAnalysisRoutes = require("./presentation/routes/analysisRoutes");
const AnalysisFacade = require("./public/AnalysisFacade");

function initializeAnalysisModule(customRepository = null) {
  const repository = customRepository || new MongoIngredientRepository();
  const service = new AnalysisService(repository);
  const controller = new AnalysisController(service, repository);
  const router = createAnalysisRoutes(controller);
  const facade = new AnalysisFacade(service, repository);

  return {
    repository,
    service,
    controller,
    router,
    facade
  };
}

module.exports = initializeAnalysisModule;
