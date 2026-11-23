// src/modules/personalization/application/services/CompatibilityService.js - Ürün/Cilt Uyumluluk Servisi
// Gerekçe: CatalogFacade ile katalog modülüne, AnalysisFacade ile analiz modülüne erişir;
// SkinCompatibilityEngine ile kişisel eşleştirme yapar ve tek bir standart DTO döner.
const SkinCompatibilityEngine = require("../../domain/services/SkinCompatibilityEngine");
const SkinProfile = require("../../domain/value-objects/SkinProfile");
const { ValidationError, NotFoundError, UnauthorizedError } = require("../../../../core/errors/AppError");

class CompatibilityService {
  constructor(userRepository, scanLogRepository, catalogFacade = null, analysisFacade = null) {
    this.userRepository = userRepository;
    this.scanLogRepository = scanLogRepository;
    this.catalogFacade = catalogFacade;
    this.analysisFacade = analysisFacade;
  }

  /**
   * Ham içerik metnini veya analiz özetini temiz bir INCI adı dizisine çevirir.
   */
  static toIngredientNames(source) {
    if (!Array.isArray(source)) {
      return String(source || "")
        .split(/[,;\n•·|]+/)
        .map(s => s.trim())
        .filter(s => s.length > 1);
    }
    return source
      .map(item => {
        if (typeof item === "string") return item.trim();
        if (!item) return "";
        return String(item.inciName || item.clean || item.raw || "").trim();
      })
      .filter(s => s.length > 1);
  }

  async checkProductCompatibility({ userId = null, barcode = null, rawIngredientsText = null, inlineProfile = null }) {
    // Seçenek A: Kişiselleştirilmiş uyumluluk analizi yalnızca giriş yapmış kullanıcılara açıktır.
    // Önceden misafir isteklerde sessizce { skinType: "sensitive" } uydurulup
    // kullanıcıya ait olmayan bir "Cildinize Uygun" skoru basılıyordu.
    if (!userId && !inlineProfile) {
      throw new UnauthorizedError(
        "Cildinize özel uyumluluk analizi için giriş yapmanız ve cilt profilinizi oluşturmanız gerekir."
      );
    }

    let skinProfile = null;
    if (userId) {
      const user = await this.userRepository.findById(userId);
      if (user) skinProfile = user.skinProfile;
    }
    if (!skinProfile && inlineProfile) {
      skinProfile = new SkinProfile(inlineProfile);
    }
    if (!skinProfile) {
      throw new ValidationError(
        "Cilt profiliniz bulunamadı. Lütfen önce cilt profili sihirbazını tamamlayın.",
        [{ field: "skinProfile", message: "Cilt profili zorunludur." }]
      );
    }

    // 2. Ürün ve İçerik Listesini Temin Et
    let productName = "Serbest İçerik Analizi";
    let brandName = "Belirtilmemiş";
    let imageUrl = null;
    let ingredientNames = [];
    let rawText = rawIngredientsText || "";

    if (barcode) {
      if (!this.catalogFacade) {
        throw new Error("CatalogFacade is not configured in CompatibilityService.");
      }
      const product = await this.catalogFacade.getProductByBarcode(barcode);
      if (!product) {
        throw new NotFoundError(`'${barcode}' barkoduna ait ürün bulunamadı.`);
      }
      productName = product.productName;
      brandName = product.brandName;
      imageUrl = product.imageUrl || null;
      rawText = product.rawIngredientsText || "";
      ingredientNames = CompatibilityService.toIngredientNames(
        Array.isArray(product.ingredientsSummary) && product.ingredientsSummary.length > 0
          ? product.ingredientsSummary
          : rawText
      );
    } else if (rawIngredientsText) {
      ingredientNames = CompatibilityService.toIngredientNames(rawIngredientsText);
    } else {
      throw new ValidationError("Lütfen barkod veya içerik metni sağlayın.");
    }

    const profileSummary = {
      skinType: skinProfile.skinType,
      conditions: skinProfile.conditions,
      completionPercentage: skinProfile.completionPercentage
    };

    // 3. İçerik verisi yoksa sahte puan ÜRETİLMEZ.
    // Katalogdaki ürünlerin büyük kısmında INCI listesi boş; motoru boş diziyle
    // çalıştırmak "100 - 0 risk = 100 puan" sonucu doğuruyor ve kullanıcıya
    // doğrulanmamış bir "mükemmel uyum" gösteriyordu.
    if (ingredientNames.length === 0) {
      return {
        product: { barcode, productName, brandName, imageUrl },
        hasIngredients: false,
        status: "INSUFFICIENT_DATA",
        message: "Bu ürünün içerik (INCI) listesi veritabanımızda bulunmuyor; uyumluluk skoru hesaplanamıyor.",
        userProfile: profileSummary,
        compatibility: null,
        safety: null,
        conflicts: null,
        evaluation: null
      };
    }

    // 4. Dermatolojik Uyumluluk Motoru (kişisel) + Regülasyon Analizi (genel) + Çakışma Motoru
    const report = SkinCompatibilityEngine.evaluate(skinProfile, ingredientNames);

    let safety = null;
    let conflicts = null;
    if (this.analysisFacade) {
      try {
        const analysis = await this.analysisFacade.analyzeText(rawText || ingredientNames.join(", "));
        safety = analysis.summary;
        conflicts = analysis.conflicts;
      } catch (_) {
        // Genel güvenlik analizi başarısız olsa bile kişisel uyumluluk raporu döner
      }
    }

    // 5. TTL Log Kaydı
    if (this.scanLogRepository && barcode) {
      await this.scanLogRepository.logScan({
        userId,
        barcode,
        compatibilityScore: report.compatibilityScore
      });
    }

    return {
      product: { barcode, productName, brandName, imageUrl },
      hasIngredients: true,
      status: report.isCompatible ? "COMPATIBLE" : "NOT_COMPATIBLE",
      userProfile: profileSummary,
      compatibility: {
        compatibilityScore: report.compatibilityScore,
        isCompatible: report.isCompatible,
        riskLevel: report.riskLevel,
        totalWarnings: report.totalWarnings,
        warnings: report.warnings,
        matchedAllergens: report.warnings
          .filter(w => w.type === "PERSONAL_ALLERGEN")
          .map(w => w.ingredient),
        flaggedIngredients: report.warnings
          .filter(w => w.type !== "PERSONAL_ALLERGEN")
          .map(w => ({ name: w.ingredient, reason: w.message, severity: w.severity })),
        analyzedIngredients: ingredientNames.length
      },
      safety,
      conflicts,
      // Geriye dönük uyumluluk: mevcut istemciler `evaluation` alanını okuyor
      evaluation: report
    };
  }
}

module.exports = CompatibilityService;
