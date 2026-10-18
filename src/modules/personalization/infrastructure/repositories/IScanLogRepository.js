// src/modules/personalization/infrastructure/repositories/IScanLogRepository.js
class IScanLogRepository {
  async logScan({ userId = null, barcode, compatibilityScore = null }) {
    throw new Error("Method logScan() must be implemented.");
  }

  async findRecentLogs({ page = 1, limit = 20 } = {}) {
    throw new Error("Method findRecentLogs() must be implemented.");
  }
}

module.exports = IScanLogRepository;

