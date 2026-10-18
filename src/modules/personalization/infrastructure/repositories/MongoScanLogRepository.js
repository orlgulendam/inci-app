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

  async findRecentLogs({ page = 1, limit = 20 } = {}) {
    try {
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip = (Math.max(1, page) - 1) * safeLimit;

      const total = await this.collection.countDocuments();
      const docs = await this.collection
        .find()
        .sort({ scanned_at: -1 })
        .skip(skip)
        .limit(safeLimit)
        .toArray();

      return {
        items: docs.map(d => ({
          id: d._id,
          userId: d.user_id,
          barcode: d.barcode,
          compatibilityScore: d.compatibility_score,
          scannedAt: d.scanned_at
        })),
        meta: {
          total,
          page,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit)
        }
      };
    } catch (err) {
      logger.error("Error reading scan logs for admin", { error: err.message });
      return { items: [], meta: { total: 0, page: 1, limit, totalPages: 0 } };
    }
  }
}

module.exports = MongoScanLogRepository;

