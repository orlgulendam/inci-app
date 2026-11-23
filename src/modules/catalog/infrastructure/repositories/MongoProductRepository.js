// src/modules/catalog/infrastructure/repositories/MongoProductRepository.js - Somut Ürün Deposu (DIP & Repository Deseni)
// Gerekçe: IProductRepository arayüzünü uygulayarak MongoDB sorgularını iş mantığından tamamen soyutlar.
const { ObjectId } = require("mongodb");
const { getDb } = require("../../../../core/database/mongo");
const logger = require("../../../../core/logging/logger");
const Product = require("../../domain/entities/Product");
const Barcode = require("../../domain/value-objects/Barcode");
const IProductRepository = require("./IProductRepository");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class MongoProductRepository extends IProductRepository {
  get collection() {
    return getDb().collection("products");
  }

  // Yardımcı: Eski ve yeni veri şemalarını ortak Domain Entity'e dönüştürür
  static toDomain(doc) {
    if (!doc) return null;

    const rawBarcode = doc.barcode || doc.code || (doc._id ? String(doc._id) : null);
    if (!rawBarcode) return null;

    // Barkod 8-14 haneli değilse (örn. Sephora slug veya alfasayısal kod) deterministik 12 haneli barkod üret
    let cleanBarcode = String(rawBarcode).replace(/\D/g, "");
    if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
      let hash = 0;
      const seedStr = String(doc.code || doc._id || rawBarcode);
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
      }
      cleanBarcode = "20" + String(hash).padStart(10, "0").slice(0, 10);
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
      const orConditions = [
        { _id: clean },
        { barcode: clean },
        { code: clean },
        { barcodes: clean },
        { generated_barcode: clean }
      ];

      if (ObjectId.isValid(clean)) {
        orConditions.push({ _id: new ObjectId(clean) });
      }

      let doc = await this.collection.findOne({ $or: orConditions });
      if (doc) {
        return MongoProductRepository.toDomain(doc);
      }

      // Eğer deterministik üretilmiş bir barkod ise, arama ile eşleştir
      return null;
    } catch (err) {
      logger.error(`Error finding product by barcode: ${barcodeStr}`, { error: err.message });
      return null;
    }
  }

  // Sıralama (Sort) Stratejisi. null dönerse doğal (indeks) sırası kullanılır:
  // 79.821 dokümanda indekssiz bir alana göre sıralamak bellekte bloke edici SORT'a yol açıyor.
  static buildSort(sort) {
    if (sort === "safetyScore:desc" || sort === "-safetyScore") {
      return { "safety_summary.safetyScore": -1, _id: -1 };
    }
    if (sort === "safetyScore:asc" || sort === "safetyScore") {
      return { "safety_summary.safetyScore": 1, _id: -1 };
    }
    if (sort === "name:asc" || sort === "productName:asc") {
      return { product_name: 1, _id: -1 };
    }
    if (sort === "name:desc" || sort === "productName:desc") {
      return { product_name: -1, _id: -1 };
    }
    return null;
  }

  // Tek bir filtreyi çalıştırıp sayfalanmış sonucu döndürür.
  async _runQuery({ filter, sortCriteria, projection, skip, limit, page }) {
    let cursor = this.collection.find(filter);
    if (projection) cursor = cursor.project(projection);
    if (sortCriteria) cursor = cursor.sort(sortCriteria);

    const docs = await cursor.skip(skip).limit(limit).toArray();
    // Toplam sayım 10.000 ile sınırlanır: büyük katalogda tam sayım tek başına saniyeler sürüyor.
    const total = await this.collection.countDocuments(filter, { limit: 10000 });
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      items: docs.map(MongoProductRepository.toDomain).filter(Boolean),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1 && page <= totalPages + 1
      }
    };
  }

  /**
   * Katmanlı (tiered) ürün arama. Her katman indeks kullanır; ilk sonuç veren katman kazanır.
   * Eski sürüm tüm isim/marka alanlarında çapasız (unanchored) case-insensitive regex kullanıyordu;
   * bu hiçbir indeksi kullanamadığı için her aramada 79.821 dokümanı tarayıp 7-21 saniye sürüyordu.
   */
  async search({ query, category, brand, sort, limit = 20, page = 1 }) {
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (safePage - 1) * safeLimit;
    const sortCriteria = MongoProductRepository.buildSort(sort);

    try {
      const baseFilter = {};
      if (category && category !== "all") {
        baseFilter.category = category;
      }
      if (brand && typeof brand === "string" && brand.trim().length > 0) {
        // Çapalı (anchored) önek: brand_name_1 / brands_1 indekslerini kullanabilir.
        const brandPrefix = new RegExp("^" + escapeRegex(brand.trim()), "i");
        baseFilter.$and = [{ $or: [{ brand_name: brandPrefix }, { brands: brandPrefix }] }];
      }

      const q = (query || "").trim();
      if (!q) {
        return await this._runQuery({ filter: baseFilter, sortCriteria, skip, limit: safeLimit, page: safePage });
      }

      // 1. KATMAN: Barkod / ürün kodu tam eşleşmesi (tamamı indeksli, ~5ms)
      if (/^\d{8,14}$/.test(q)) {
        const exact = await this._runQuery({
          filter: {
            ...baseFilter,
            $or: [{ barcode: q }, { code: q }, { barcodes: q }, { generated_barcode: q }, { _id: q }]
          },
          sortCriteria,
          skip: 0,
          limit: safeLimit,
          page: 1
        });
        if (exact.items.length > 0) return exact;
      }

      // 2. KATMAN: Tam metin araması (idx_products_text_search). Birincil katman:
      // tam kelimeleri konumdan bağımsız bulur, alaka düzeyine (textScore) göre sıralar ve ~2-120ms sürer.
      // Ön yüz taramasından gelen çok kelimeli sorgular ("Maybelline Fit Me 120") da burada eşleşir.
      const textResult = await this._runQuery({
        filter: { ...baseFilter, $text: { $search: q } },
        // _id ikincil ölçüt: eşit textScore'da sıra belirsiz kalırsa sayfalar arası tekrar oluşuyor.
        sortCriteria: sortCriteria || { score: { $meta: "textScore" }, _id: 1 },
        projection: { score: { $meta: "textScore" } },
        skip,
        limit: safeLimit,
        page: safePage
      });
      if (textResult.items.length > 0) return textResult;

      // 3. KATMAN: Çapalı önek araması - yarım kelimeler için ("cer" -> "CeraVe").
      // Tam metin indeksi önek eşleşmesi yapmadığı için otomatik tamamlama bu katmandan beslenir.
      // Büyük/küçük harf duyarsız regex indeks içinde tam tarama yapar, bu yüzden en sonda.
      const prefix = new RegExp("^" + escapeRegex(q), "i");
      return await this._runQuery({
        filter: {
          ...baseFilter,
          $or: [
            { brand_name: prefix },
            { brands: prefix },
            { product_name: prefix },
            { product_name_tr: prefix },
            { product_name_en: prefix }
          ]
        },
        sortCriteria,
        skip,
        limit: safeLimit,
        page: safePage
      });
    } catch (err) {
      logger.error("Error searching products in repository", { error: err.message });
      return {
        items: [],
        meta: { total: 0, page: safePage, limit: safeLimit, totalPages: 0, hasNext: false, hasPrev: false }
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

      // Guncelleme filtresi: _id bilindiginde ONCE onu kullan.
      // Yalnizca { barcode } ile upsert etmek, toDomain temizlenmis/uretilmis bir
      // barkod dondurdugunde mevcut dokumani guncellemek yerine eksik alanli
      // YENI bir dokuman olusturur (dokuman cogaltmasi).
      const filter = product.id ? { _id: product.id } : { barcode: barcodeValue };

      const result = await this.collection.updateOne(
        filter,
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
