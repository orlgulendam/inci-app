// src/modules/community/infrastructure/repositories/IContributionRepository.js - Katkı Deposu Arayüzü (DIP)
class IContributionRepository {
  async findById(id, session = null) {
    throw new Error("Method findById() must be implemented.");
  }

  async findPending({ page = 1, limit = 20 } = {}) {
    throw new Error("Method findPending() must be implemented.");
  }

  async save(contribution, session = null) {
    throw new Error("Method save() must be implemented.");
  }
}

module.exports = IContributionRepository;
