// src/modules/catalog/infrastructure/adapters/OpenBeautyFactsAdapter.js - Harici Katalog Adaptörü (Adapter Pattern)
// Gerekçe: Barkod yerel katalogda bulunamadığında ücretsiz Open Beauty Facts API'sinden
// ürünü anlık çekerek "Barkod Kayıtlı Değil" çıkmazını azaltır.
//
// Tasarım notları:
// - Yumuşak başarısızlık (fail-soft): API yavaş/kapalıysa null döner, kullanıcı akışı bloke olmaz.
// - Kısa zaman aşımı: ürün detay isteği kullanıcıyı bekletmemeli.
// - Dışarı yalnızca barkod gönderilir; kullanıcıya ait hiçbir bilgi paylaşılmaz.
const logger = require("../../../../core/logging/logger");

const DEFAULT_BASE_URL = "https://world.openbeautyfacts.org";
const DEFAULT_TIMEOUT_MS = 4000;

class OpenBeautyFactsAdapter {
  constructor({ baseUrl = DEFAULT_BASE_URL, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = null } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl || globalThis.fetch;
  }

  /**
   * Open Beauty Facts dokümanından INCI içerik metnini en iyi şekilde çıkarır.
   */
  static extractIngredientsText(doc) {
    if (!doc) return "";

    const candidates = [
      doc.ingredients_text_tr,
      doc.lc ? doc["ingredients_text_" + doc.lc] : null,
      doc.ingredients_text,
      doc.ingredients_text_en,
      doc.ingredients_text_fr,
      doc.ingredients_text_with_allergens
    ];

    for (const text of candidates) {
      if (typeof text === "string" && text.trim().length > 3) return text.trim();
    }

    if (Array.isArray(doc.ingredients) && doc.ingredients.length > 0) {
      const list = doc.ingredients
        .map(i => (typeof i === "string" ? i : i && i.text))
        .filter(t => typeof t === "string" && t.trim().length > 1);
      if (list.length > 0) return list.join(", ");
    }

    return "";
  }

  /**
   * Barkodu Open Beauty Facts üzerinde arar.
   * @returns {Promise<Object|null>} ProductService.createOrUpdate ile uyumlu nesne veya null
   */
  async fetchByBarcode(barcode) {
    const code = String(barcode || "").trim();
    if (!/^\d{8,14}$/.test(code)) return null;
    if (typeof this.fetchImpl !== "function") return null;

    const url = `${this.baseUrl}/api/v2/product/${encodeURIComponent(code)}.json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        logger.warn("Open Beauty Facts isteği başarısız", { barcode: code, status: res.status });
        return null;
      }

      const payload = await res.json();
      if (payload.status !== 1 || !payload.product) return null;

      const doc = payload.product;
      const productName =
        doc.product_name_tr || doc.product_name || doc.product_name_en || doc.product_name_fr || "";
      if (!productName.trim()) return null;

      return {
        barcode: code,
        productName: productName.trim(),
        brandName: (doc.brands || "Bilinmeyen Marka").trim(),
        category: doc.categories_tags?.[0] || "skincare",
        imageUrl: doc.image_front_url || doc.image_url || doc.image_small_url || null,
        rawIngredientsText: OpenBeautyFactsAdapter.extractIngredientsText(doc),
        isVerified: false,
        source: "openbeautyfacts"
      };
    } catch (err) {
      if (err.name === "AbortError") {
        logger.warn("Open Beauty Facts isteği zaman aşımına uğradı", { barcode: code, timeoutMs: this.timeoutMs });
      } else {
        logger.warn("Open Beauty Facts adaptör hatası", { barcode: code, error: err.message });
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = OpenBeautyFactsAdapter;
