// src/modules/personalization/public/PersonalizationFacade.js - Cephe Deseni (Facade Pattern)
// Gerekçe: Kullanıcı hesapları ve puan yönetimini community modülüne multi-document ACID transaction desteğiyle sunmak.

class PersonalizationFacade {
  constructor(userRepository, compatibilityService) {
    this.userRepository = userRepository;
    this.compatibilityService = compatibilityService;
  }

  async getUser(userId) {
    return this.userRepository.findById(userId);
  }

  /**
   * Kullanıcıya puan kazandırır (Multi-document ACID transaction içinde çalışabilir)
   */
  async addRewardPoints(userId, points, session = null) {
    return this.userRepository.updatePoints(userId, points, session);
  }

  async checkProductCompatibility(userId, barcode) {
    return this.compatibilityService.checkProductCompatibility({ userId, barcode });
  }
}

module.exports = PersonalizationFacade;
