// src/modules/analysis/infrastructure/repositories/MongoIngredientRepository.js - Somut Repository (DIP)
// Gerekçe: IIngredientRepository arayüzünü uygulayarak MongoDB erişimini soyutlar.
const { getDb } = require("../../../../core/database/mongo");
const logger = require("../../../../core/logging/logger");
const Ingredient = require("../../domain/entities/Ingredient");
const IIngredientRepository = require("./IIngredientRepository");

class MongoIngredientRepository extends IIngredientRepository {
  constructor() {
    super();
    this.memoryCache = new Map();
    this.initialized = false;
  }

  get collection() {
    return getDb().collection("ingredients");
  }

  // Normalizasyon fonksiyonu (karakter temizleme ve küçük harfe çekme)
  static normalizeKey(name) {
    if (!name) return "";
    return name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  // Domain Entity Dönüştürücü
  static toDomain(doc) {
    if (!doc) return null;
    return new Ingredient({
      id: doc._id,
      inciName: doc.inci_name || doc.name,
      casNumber: doc.cas_number || doc.cas,
      functions: doc.functions_en || doc.functions || [],
      functionsTr: doc.functions_tr || [],
      flags: doc.flags || {},
      euAnnex: doc.eu_annex || {},
      noteTr: doc.note_tr || null
    });
  }

  async ensureCache() {
    if (this.initialized) return;
    try {
      const cursor = this.collection.find({}, {
        projection: {
          inci_name: 1,
          name: 1,
          cas_number: 1,
          cas: 1,
          functions_en: 1,
          functions: 1,
          functions_tr: 1,
          flags: 1,
          eu_annex: 1,
          note_tr: 1
        }
      });

      const docs = await cursor.toArray();
      for (const d of docs) {
        const name = d.inci_name || d.name;
        if (name) {
          const key = MongoIngredientRepository.normalizeKey(name);
          this.memoryCache.set(key, d);
        }
      }
      this.initialized = true;
      logger.info(`Ingredient cache primed with ${this.memoryCache.size} chemicals from MongoDB.`);
    } catch (err) {
      // Fallback: Yerel JSON sözlükten yükle (Veritabanı offline iken dahi 30.000+ kimyasal çalışır)
      try {
        const fs = require("fs");
        const path = require("path");
        const jsonPath = path.resolve(process.cwd(), "data/glossary.flagged.json");
        if (fs.existsSync(jsonPath)) {
          const items = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
          for (const item of items) {
            const name = item.name || item.inci_name;
            if (name) {
              const key = MongoIngredientRepository.normalizeKey(name);
              this.memoryCache.set(key, {
                inci_name: name,
                cas_number: item.cas,
                functions_en: item.functions,
                functions_tr: item.functions_tr,
                flags: item.flags,
                eu_annex: item.eu_annex,
                note_tr: item.note_tr
              });
            }
          }
          this.initialized = true;
          logger.info(`Ingredient cache primed with ${this.memoryCache.size} chemicals from local fallback JSON.`);
        }
      } catch (fileErr) {
        logger.warn(`Could not prime memory cache (${err.message} / ${fileErr.message}).`);
      }
    }
  }

  async findByInciName(inciName) {
    const key = MongoIngredientRepository.normalizeKey(inciName);
    if (!key) return null;

    await this.ensureCache();

    // 1. Önce 0ms In-Memory Cache'e bak
    if (this.memoryCache.has(key)) {
      return MongoIngredientRepository.toDomain(this.memoryCache.get(key));
    }

    // 2. Cache'te yoksa doğrudan MongoDB'den sorgula
    try {
      const doc = await this.collection.findOne({
        $or: [
          { inci_name: new RegExp(`^${inciName}$`, "i") },
          { name: new RegExp(`^${inciName}$`, "i") }
        ]
      });

      if (doc) {
        this.memoryCache.set(key, doc);
        return MongoIngredientRepository.toDomain(doc);
      }
    } catch (err) {
      logger.error(`Error querying ingredient: ${inciName}`, { error: err.message });
    }

    return null;
  }

  async search(query, limit = 20) {
    if (!query || query.trim().length < 2) return [];

    const safeLimit = Math.min(50, limit);
    const regex = new RegExp(query.trim(), "i");

    try {
      const docs = await this.collection.find({
        $or: [
          { inci_name: regex },
          { name: regex },
          { cas_number: regex },
          { "functions_tr": regex }
        ]
      }).limit(safeLimit).toArray();

      return docs.map(MongoIngredientRepository.toDomain);
    } catch (err) {
      logger.error(`Error searching ingredients with query: ${query}`, { error: err.message });
      return [];
    }
  }

  async bulkFindByInciNames(names) {
    const results = new Map();
    for (const n of names) {
      const found = await this.findByInciName(n);
      if (found) results.set(n, found);
    }
    return results;
  }
}

module.exports = MongoIngredientRepository;
