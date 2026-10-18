// src/modules/community/infrastructure/repositories/MongoContributionRepository.js - Somut Katkı Deposu (DIP)
const { ObjectId } = require("mongodb");
const { getDb } = require("../../../../core/database/mongo");
const logger = require("../../../../core/logging/logger");
const Contribution = require("../../domain/entities/Contribution");
const ContributionStatus = require("../../domain/value-objects/ContributionStatus");
const IContributionRepository = require("./IContributionRepository");

class MongoContributionRepository extends IContributionRepository {
  get collection() {
    return getDb().collection("contributions");
  }

  static toDomain(doc) {
    if (!doc) return null;
    return new Contribution({
      id: doc._id,
      userId: doc.user_id,
      barcode: doc.barcode,
      productName: doc.product_name,
      brandName: doc.brand_name || "Bilinmeyen Marka",
      rawIngredientsText: doc.raw_ingredients_text || "",
      imageUrl: doc.image_url || null,
      status: new ContributionStatus(doc.status),
      reviewerNote: doc.reviewer_note || null,
      createdAt: doc.created_at,
      reviewedAt: doc.reviewed_at || null
    });
  }

  async findById(id, session = null) {
    try {
      const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
      const options = session ? { session } : {};
      const doc = await this.collection.findOne(query, options);
      return MongoContributionRepository.toDomain(doc);
    } catch (err) {
      logger.error(`Error finding contribution: ${id}`, { error: err.message });
      return null;
    }
  }

  async findPending({ page = 1, limit = 20 } = {}) {
    try {
      const safeLimit = Math.min(50, Math.max(1, limit));
      const skip = (Math.max(1, page) - 1) * safeLimit;
      const query = { status: ContributionStatus.PENDING };

      const total = await this.collection.countDocuments(query);
      const docs = await this.collection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(safeLimit)
        .toArray();

      return {
        items: docs.map(MongoContributionRepository.toDomain),
        meta: {
          total,
          page,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit)
        }
      };
    } catch (err) {
      logger.error("Error finding pending contributions", { error: err.message });
      return { items: [], meta: { total: 0, page: 1, limit, totalPages: 0 } };
    }
  }

  async save(contribution, session = null) {
    try {
      const doc = {
        user_id: contribution.userId,
        barcode: contribution.barcode,
        product_name: contribution.productName,
        brand_name: contribution.brandName,
        raw_ingredients_text: contribution.rawIngredientsText,
        image_url: contribution.imageUrl,
        status: contribution.status.value,
        reviewer_note: contribution.reviewerNote,
        reviewed_at: contribution.reviewedAt
      };

      const options = session ? { session } : {};

      if (contribution.id) {
        const query = ObjectId.isValid(contribution.id)
          ? { _id: new ObjectId(contribution.id) }
          : { _id: contribution.id };
        await this.collection.updateOne(query, { $set: doc }, options);
        return contribution.id;
      } else {
        doc.created_at = contribution.createdAt;
        const res = await this.collection.insertOne(doc, options);
        return res.insertedId;
      }
    } catch (err) {
      logger.error("Error saving contribution", { error: err.message });
      throw err;
    }
  }
}

module.exports = MongoContributionRepository;
