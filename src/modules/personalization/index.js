// src/modules/personalization/index.js - Personalization Modülü Giriş Noktası (Composition Root)
const MongoUserRepository = require("./infrastructure/repositories/MongoUserRepository");
const MongoScanLogRepository = require("./infrastructure/repositories/MongoScanLogRepository");
const AuthService = require("./application/services/AuthService");
const ProfileService = require("./application/services/ProfileService");
const CompatibilityService = require("./application/services/CompatibilityService");
const AuthController = require("./presentation/controllers/AuthController");
const ProfileController = require("./presentation/controllers/ProfileController");
const createAuthMiddleware = require("./presentation/middlewares/authMiddleware");
const createPersonalizationRoutes = require("./presentation/routes/personalizationRoutes");
const PersonalizationFacade = require("./public/PersonalizationFacade");

function initializePersonalizationModule({
  catalogFacade = null,
  userRepository = null,
  scanLogRepository = null
} = {}) {
  const userRepo = userRepository || new MongoUserRepository();
  const scanRepo = scanLogRepository || new MongoScanLogRepository();

  const authService = new AuthService(userRepo);
  const profileService = new ProfileService(userRepo);
  const compatibilityService = new CompatibilityService(userRepo, scanRepo, catalogFacade);

  const authMiddleware = createAuthMiddleware(authService);
  const authController = new AuthController(authService);
  const profileController = new ProfileController(profileService, compatibilityService);

  const router = createPersonalizationRoutes(authController, profileController, authMiddleware);
  const facade = new PersonalizationFacade(userRepo, compatibilityService);

  return {
    userRepository: userRepo,
    scanLogRepository: scanRepo,
    authService,
    profileService,
    compatibilityService,
    authMiddleware,
    router,
    facade
  };
}

module.exports = initializePersonalizationModule;
