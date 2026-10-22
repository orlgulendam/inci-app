// src/modules/analysis/index.js - Analysis Modülü Giriş Noktası
const MongoIngredientRepository = require("./infrastructure/repositories/MongoIngredientRepository");
const AnalysisService = require("./application/services/AnalysisService");
const AnalysisController = require("./presentation/controllers/AnalysisController");
const createAnalysisRoutes = require("./presentation/routes/analysisRoutes");
const AnalysisFacade = require("./public/AnalysisFacade");

function initializeAnalysisModule(customRepositoryOrOptions = null) {
  let repository = null;
  let ocrService = null;

  if (customRepositoryOrOptions && typeof customRepositoryOrOptions === "object") {
    if (customRepositoryOrOptions.findByInciName || customRepositoryOrOptions.search) {
      repository = customRepositoryOrOptions;
    } else {
      repository = customRepositoryOrOptions.repository;
      ocrService = customRepositoryOrOptions.ocrService;
    }
  }

  repository = repository || new MongoIngredientRepository();
  const service = new AnalysisService(repository);
  const controller = new AnalysisController(service, repository, ocrService);
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
