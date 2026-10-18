// src/modules/personalization/infrastructure/repositories/MongoScanLogRepository.js
const { getDb } = require("../../../../core/database/mongo");
const logger = require("../../../../core/logging/logger");
const IScanLogRepository = require("./IScanLogRepository");

class MongoScanLogRepository extends IScanLogRepository {
  get collection() {
    return getDb().collection("scan_logs");
  }

  async logScan({ userId = null, barcode, compatibilityScore = null }) {
    try {
      await this.collection.insertOne({
        user_id: userId,
        barcode,
        compatibility_score: compatibilityScore,
        scanned_at: new Date() // TTL indeksi bu alanda çalışır
      });
    } catch (err) {
      logger.warn(`Failed to write scan log: ${err.message}`);
    }
  }
}

module.exports = MongoScanLogRepository;
