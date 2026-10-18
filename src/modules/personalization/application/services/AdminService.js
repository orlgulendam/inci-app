// src/modules/personalization/application/services/AdminService.js - Yönetici İşlemleri Servisi (SRP)
class AdminService {
  constructor(userRepository, scanLogRepository) {
    this.userRepository = userRepository;
    this.scanLogRepository = scanLogRepository;
  }

  async listUsers({ page = 1, limit = 20, search = null } = {}) {
    return this.userRepository.findAllUsers({ page: Number(page) || 1, limit: Number(limit) || 20, search });
  }

  async listScanLogs({ page = 1, limit = 20 } = {}) {
    return this.scanLogRepository.findRecentLogs({ page: Number(page) || 1, limit: Number(limit) || 20 });
  }
}

module.exports = AdminService;
