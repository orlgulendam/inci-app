// src/modules/personalization/infrastructure/repositories/IScanLogRepository.js
class IScanLogRepository {
  async logScan({ userId = null, barcode, compatibilityScore = null }) {
    throw new Error("Method logScan() must be implemented.");
  }
}

module.exports = IScanLogRepository;
