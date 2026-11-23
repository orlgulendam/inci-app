// src/modules/catalog/application/services/ProductService.js - Ürün İş Mantığı Servisi (SRP & DIP)
// Gerekçe: analysisFacade ile modüller arası temiz Facade iletişimi kurarak içerik analizini bağlar.
const Product = require("../../domain/entities/Product");
const Barcode = require("../../domain/value-objects/Barcode");
const { NotFoundError, ValidationError } = require("../../../../core/errors/AppError");
const eventBus = require("../../../../core/events/eventBus");

class ProductService {
  constructor(productRepository, brandRepository, analysisFacade = null) {
    this.productRepository = productRepository;
    this.brandRepository = brandRepository;
    this.analysisFacade = analysisFacade;
  }

  /**
   * Ürünün yeniden analiz edilmesi gerekiyor mu?
   * Katalogdaki 3.300 ürün, `score`/`status` içermeyen eski şemayla
   * ({ is_clean, banned_count, ... }) önbelleğe alınmış. Bu özet "var" sayıldığı için
   * ürünler güvenlik skoru olmadan dönüyordu; `score` yoksa özet geçersiz kabul edilir.
   */
  static needsAnalysis(product) {
    const summary = product.safetySummary;
    if (!summary || typeof summary.score !== "number") return true;
    return !Array.isArray(product.ingredientsSummary) || product.ingredientsSummary.length === 0;
  }

  async getByBarcode(barcodeStr) {
    if (!barcodeStr) {
      throw new ValidationError("Barkod parametresi boş olamaz.");
    }

    let searchCode = String(barcodeStr).trim();
    try {
      const barcodeVO = new Barcode(searchCode);
      searchCode = barcodeVO.getValue();
    } catch (_) {
      // Alfasayısal kod, slug veya ObjectId olabilir; doğrudan sorgula
    }

    const product = await this.productRepository.findByBarcode(searchCode);

    if (!product) {
      throw new NotFoundError(`'${barcodeStr}' koduna ait ürün katalogda bulunamadı.`);
    }

    // Lazy Enrichment: Ürünün ham içeriği var ama henüz geçerli bir analiz özeti yoksa
    // analysisFacade üzerinden anında analiz edip dokümana göm
    if (this.analysisFacade && product.rawIngredientsText && ProductService.needsAnalysis(product)) {
      try {
        const analysis = await this.analysisFacade.analyzeText(product.rawIngredientsText);
        product.safetySummary = analysis.summary;
        product.ingredientsSummary = analysis.items;
        await this.productRepository.save(product);
      } catch (_) {
        // Analiz hatası ürün gösterimini engellemesin
      }
    }

    return product;
  }

  async search({ query, category, brand, sort, limit = 20, page = 1 }) {
    return this.productRepository.search({ query, category, brand, sort, limit, page });
  }

  async createOrUpdate(data) {
    if (!data.productName || !data.barcode) {
      throw new ValidationError("Ürün adı ve barkod zorunludur.");
    }

    let ingredientsSummary = data.ingredientsSummary || [];
    let safetySummary = data.safetySummary || null;

    // Eğer ham içerik metni verilmişse ve analiz yoksa analysisFacade ile analiz et
    if (this.analysisFacade && data.rawIngredientsText && (!safetySummary || ingredientsSummary.length === 0)) {
      const analysis = await this.analysisFacade.analyzeText(data.rawIngredientsText);
      safetySummary = analysis.summary;
      ingredientsSummary = analysis.items;
    }

    const product = new Product({
      id: data.id,
      barcode: new Barcode(data.barcode),
      brandId: data.brandId,
      brandName: data.brandName || "Bilinmeyen Marka",
      productName: data.productName,
      category: data.category || "skincare",
      imageUrl: data.imageUrl,
      rawIngredientsText: data.rawIngredientsText || "",
      ingredientsSummary,
      safetySummary,
      isVerified: data.isVerified !== false
    });

    const savedId = await this.productRepository.save(product);

    // Observer Deseni: Ürün güncellendiğinde olay veriyoluna bildir
    eventBus.publish("product.updated", {
      barcode: product.getBarcodeValue(),
      productName: product.productName,
      brandName: product.brandName
    });

    return { id: savedId, product };
  }
}

module.exports = ProductService;
