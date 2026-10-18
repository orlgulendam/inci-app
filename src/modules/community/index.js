// src/modules/community/index.js - Community Modülü Giriş Noktası (Composition Root)
const MongoContributionRepository = require("./infrastructure/repositories/MongoContributionRepository");
const ContributionService = require("./application/services/ContributionService");
const ContributionController = require("./presentation/controllers/ContributionController");
const createCommunityRoutes = require("./presentation/routes/communityRoutes");
const CommunityFacade = require("./public/CommunityFacade");

function initializeCommunityModule({
  catalogFacade = null,
  personalizationFacade = null,
  authMiddleware = null,
  contributionRepository = null,
  transactionRunner = null
} = {}) {
  const repo = contributionRepository || new MongoContributionRepository();
  const service = new ContributionService(repo, catalogFacade, personalizationFacade, transactionRunner);
  const controller = new ContributionController(service);
  const router = createCommunityRoutes(controller, authMiddleware);
  const facade = new CommunityFacade(service);

  return {
    contributionRepository: repo,
    contributionService: service,
    contributionController: controller,
    router,
    facade
  };
}

module.exports = initializeCommunityModule;
