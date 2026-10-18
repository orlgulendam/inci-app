// src/modules/catalog/infrastructure/repositories/MongoBrandRepository.js - Somut Marka Deposu (DIP)
const { getDb } = require("../../../../core/database/mongo");
const logger = require("../../../../core/logging/logger");
const Brand = require("../../domain/entities/Brand");
const IBrandRepository = require("./IBrandRepository");

class MongoBrandRepository extends IBrandRepository {
  get collection() {
    return getDb().collection("brands");
  }

  static toDomain(doc) {
    if (!doc) return null;
    return new Brand({
      id: doc._id,
      name: doc.name,
      slug: doc.slug,
      originCountry: doc.origin_country || "TR",
      isVerified: doc.is_verified,
      createdAt: doc.created_at
    });
  }

  async findAll({ limit = 50, page = 1 } = {}) {
    try {
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip = (Math.max(1, page) - 1) * safeLimit;

      const total = await this.collection.countDocuments();
      const docs = await this.collection
        .find({})
        .sort({ name: 1 })
        .skip(skip)
        .limit(safeLimit)
        .toArray();

      return {
        items: docs.map(MongoBrandRepository.toDomain),
        meta: {
          total,
          page,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit)
        }
      };
    } catch (err) {
      logger.error("Error fetching brands from repository", { error: err.message });
      return { items: [], meta: { total: 0, page: 1, limit, totalPages: 0 } };
    }
  }

  async findByName(name) {
    try {
      const doc = await this.collection.findOne({
        name: new RegExp(`^${name.trim()}$`, "i")
      });
      return MongoBrandRepository.toDomain(doc);
    } catch (err) {
      logger.error(`Error finding brand: ${name}`, { error: err.message });
      return null;
    }
  }

  async save(brand) {
    try {
      const doc = {
        name: brand.name,
        slug: brand.slug,
        origin_country: brand.originCountry,
        is_verified: brand.isVerified,
        updated_at: new Date()
      };

      const result = await this.collection.updateOne(
        { slug: brand.slug },
        { $set: doc, $setOnInsert: { created_at: brand.createdAt } },
        { upsert: true }
      );

      return result.upsertedId || brand.id;
    } catch (err) {
      logger.error(`Error saving brand: ${brand.name}`, { error: err.message });
      throw err;
    }
  }
}

module.exports = MongoBrandRepository;
