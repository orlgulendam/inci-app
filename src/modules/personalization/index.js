// src/modules/personalization/index.js - Personalization Modülü Giriş Noktası (Composition Root)
const config = require("../../core/config/env");
const MongoUserRepository = require("./infrastructure/repositories/MongoUserRepository");
 const MongoScanLogRepository = require("./infrastructure/repositories/MongoScanLogRepository");
 const AuthService = require("./application/services/AuthService");
 const ProfileService = require("./application/services/ProfileService");
 const CompatibilityService = require("./application/services/CompatibilityService");
 const AdminService = require("./application/services/AdminService");
 const ChatService = require("./application/services/ChatService");
 const GeminiFlashProvider = require("./infrastructure/ai/GeminiFlashProvider");
 const MockFallbackAiProvider = require("./infrastructure/ai/MockFallbackAiProvider");
 const AuthController = require("./presentation/controllers/AuthController");
 const ProfileController = require("./presentation/controllers/ProfileController");
 const AdminController = require("./presentation/controllers/AdminController");
 const ChatController = require("./presentation/controllers/ChatController");
 const createAuthMiddleware = require("./presentation/middlewares/authMiddleware");
 const adminMiddleware = require("./presentation/middlewares/adminMiddleware");
 const createPersonalizationRoutes = require("./presentation/routes/personalizationRoutes");
 const PersonalizationFacade = require("./public/PersonalizationFacade");

function initializePersonalizationModule({
  catalogFacade = null,
  userRepository = null,
  scanLogRepository = null,
  primaryAiProvider = null,
  fallbackAiProvider = null
} = {}) {
  const userRepo = userRepository || new MongoUserRepository();
  const scanRepo = scanLogRepository || new MongoScanLogRepository();

  const authService = new AuthService(userRepo);
  const profileService = new ProfileService(userRepo);
  const compatibilityService = new CompatibilityService(userRepo, scanRepo, catalogFacade);
  const adminService = new AdminService(userRepo, scanRepo);

  // AI Danışmanlık ve Sohbet (Strategy Pattern)
  const primaryAi = primaryAiProvider || new GeminiFlashProvider(config.ai.geminiApiKey, config.ai.geminiModel);
  const fallbackAi = fallbackAiProvider || new MockFallbackAiProvider();
  const chatService = new ChatService({
    userRepository: userRepo,
    catalogFacade,
    primaryAiProvider: primaryAi,
    fallbackAiProvider: fallbackAi
  });

  const authMiddleware = createAuthMiddleware(authService);
  const authController = new AuthController(authService);
  const profileController = new ProfileController(profileService, compatibilityService);
  const adminController = new AdminController(adminService);
  const chatController = new ChatController(chatService);

  const router = createPersonalizationRoutes({
    authController,
    profileController,
    adminController,
    chatController,
    authMiddleware,
    adminMiddleware
  });
  const facade = new PersonalizationFacade(userRepo, compatibilityService);

  return {
    userRepository: userRepo,
    scanLogRepository: scanRepo,
    authService,
    profileService,
    compatibilityService,
    adminService,
    chatService,
    authMiddleware,
    router,
    facade
  };
}

module.exports = initializePersonalizationModule;

