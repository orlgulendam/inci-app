// src/modules/catalog/infrastructure/repositories/MongoProductRepository.js - Somut Ürün Deposu (DIP & Repository Deseni)
// Gerekçe: IProductRepository arayüzünü uygulayarak MongoDB sorgularını iş mantığından tamamen soyutlar.
const { getDb } = require("../../../../core/database/mongo");
const logger = require("../../../../core/logging/logger");
const Product = require("../../domain/entities/Product");
const Barcode = require("../../domain/value-objects/Barcode");
const IProductRepository = require("./IProductRepository");

class MongoProductRepository extends IProductRepository {
  get collection() {
    return getDb().collection("products");
  }

  // Yardımcı: Eski ve yeni veri şemalarını ortak Domain Entity'e dönüştürür
  static toDomain(doc) {
    if (!doc) return null;

    const rawBarcode = doc.barcode || doc.code || (doc._id ? String(doc._id) : null);
    if (!rawBarcode) return null;

    // Barkod 8-14 haneli değilse domain VO hata vereceğinden güvenli temizlik yap
    const cleanBarcode = String(rawBarcode).replace(/\D/g, "");
    if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
      return null; // Standart dışı bozuk barkod kayıtlarını ele
    }

    const name =
      doc.product_name ||
      doc.product_name_tr ||
      doc.product_name_en ||
      doc.product_name_fr ||
      "İsimsiz Ürün";

    const brandName = doc.brand_name || doc.brands || "Bilinmeyen Marka";
    const imageUrl = doc.image_url || doc.image_front_url || doc.image_small_url || null;

    let ingredientsText = doc.raw_ingredients_text || doc.ingredients_text_tr || doc.ingredients_text || "";
    if (!ingredientsText && Array.isArray(doc.ingredients)) {
      ingredientsText = doc.ingredients
        .map(i => (typeof i === "string" ? i : (i && i.text)))
        .filter(t => typeof t === "string" && t.trim().length > 1)
        .join(", ");
    }

    return new Product({
      id: doc._id,
      barcode: new Barcode(cleanBarcode),
      brandId: doc.brand_id || null,
      brandName,
      productName: name,
      category: doc.category || "skincare",
      imageUrl,
      rawIngredientsText: ingredientsText,
      ingredientsSummary: doc.ingredients_summary || [],
      safetySummary: doc.safety_summary || null,
      isVerified: doc.is_verified !== false,
      updatedAt: doc.updated_at || new Date()
    });
  }

  async findByBarcode(barcodeStr) {
    try {
      const clean = String(barcodeStr).trim();
      const doc = await this.collection.findOne({
        $or: [
          { barcode: clean },
          { code: clean },
          { _id: clean },
          { barcodes: clean }
        ]
      });

      return MongoProductRepository.toDomain(doc);
    } catch (err) {
      logger.error(`Error finding product by barcode: ${barcodeStr}`, { error: err.message });
      return null;
    }
  }

  async search({ query, category, brand, sort, limit = 20, page = 1 }) {
    try {
      const filter = {};
      const safeLimit = Math.min(50, Math.max(1, limit));
      const safePage = Math.max(1, parseInt(page, 10) || 1);
      const skip = (safePage - 1) * safeLimit;

      if (category && category !== "all") {
        filter.category = category;
      }

      if (brand && typeof brand === "string" && brand.trim().length > 0) {
        filter.brand_name = new RegExp(brand.trim(), "i");
      }

      if (query && query.trim().length > 0) {
        const q = query.trim();
        const regex = new RegExp(q, "i");
        filter.$or = [
          { barcode: q },
          { code: q },
          { product_name: regex },
          { product_name_tr: regex },
          { brand_name: regex },
          { brands: regex }
        ];
      }

      // Sıralama (Sort) Stratejisi
      let sortCriteria = { updated_at: -1, _id: -1 };
      if (sort === "safetyScore:desc" || sort === "-safetyScore") {
        sortCriteria = { "safety_summary.safetyScore": -1, _id: -1 };
      } else if (sort === "safetyScore:asc" || sort === "safetyScore") {
        sortCriteria = { "safety_summary.safetyScore": 1, _id: -1 };
      } else if (sort === "name:asc" || sort === "productName:asc") {
        sortCriteria = { product_name: 1, _id: -1 };
      } else if (sort === "name:desc" || sort === "productName:desc") {
        sortCriteria = { product_name: -1, _id: -1 };
      }

      const total = await this.collection.countDocuments(filter);
      const docs = await this.collection
        .find(filter)
        .sort(sortCriteria)
        .skip(skip)
        .limit(safeLimit)
        .toArray();

      const items = docs.map(MongoProductRepository.toDomain).filter(Boolean);
      const totalPages = Math.ceil(total / safeLimit) || (total === 0 ? 0 : 1);

      return {
        items,
        meta: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages,
          hasNext: safePage < totalPages,
          hasPrev: safePage > 1 && safePage <= totalPages + 1
        }
      };
    } catch (err) {
      logger.error("Error searching products in repository", { error: err.message });
      return {
        items: [],
        meta: { total: 0, page: 1, limit, totalPages: 0, hasNext: false, hasPrev: false }
      };
    }
  }

  async save(product) {
    try {
      const barcodeValue = product.getBarcodeValue();
      const doc = {
        barcode: barcodeValue,
        brand_id: product.brandId,
        brand_name: product.brandName,
        product_name: product.productName,
        category: product.category,
        image_url: product.imageUrl,
        raw_ingredients_text: product.rawIngredientsText,
        ingredients_summary: product.ingredientsSummary,
        safety_summary: product.safetySummary,
        is_verified: product.isVerified,
        updated_at: new Date()
      };

      const result = await this.collection.updateOne(
        { barcode: barcodeValue },
        { $set: doc },
        { upsert: true }
      );

      return result.upsertedId ? result.upsertedId : product.id;
    } catch (err) {
      logger.error(`Error saving product: ${product.getBarcodeValue()}`, { error: err.message });
      throw err;
    }
  }
}

module.exports = MongoProductRepository;
