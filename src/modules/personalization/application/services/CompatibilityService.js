// src/modules/personalization/application/services/CompatibilityService.js - Ürün/Cilt Uyumluluk Servisi
// Gerekçe: CatalogFacade ile katalog modülüne erişir, SkinCompatibilityEngine ile eşleştirme yapar.
const SkinCompatibilityEngine = require("../../domain/services/SkinCompatibilityEngine");
const SkinProfile = require("../../domain/value-objects/SkinProfile");
const { ValidationError, NotFoundError } = require("../../../../core/errors/AppError");

class CompatibilityService {
  constructor(userRepository, scanLogRepository, catalogFacade = null) {
    this.userRepository = userRepository;
    this.scanLogRepository = scanLogRepository;
    this.catalogFacade = catalogFacade;
  }

  async checkProductCompatibility({ userId = null, barcode = null, rawIngredientsText = null, inlineProfile = null }) {
    let skinProfile = null;

    // 1. Profil Tespiti: Giriş yapmış kullanıcının profilini al veya inline profili kullan
    if (userId) {
      const user = await this.userRepository.findById(userId);
      if (user) skinProfile = user.skinProfile;
    }

    if (!skinProfile && inlineProfile) {
      skinProfile = new SkinProfile(inlineProfile);
    }

    if (!skinProfile) {
      // Misafir kullanıcı için genel hassas profil varsayımı
      skinProfile = new SkinProfile({ skinType: "sensitive", conditions: ["fragrance_sensitive"] });
    }

    // 2. Ürün ve İçerik Listesini Temin Et
    let productName = "Serbest İçerik Analizi";
    let brandName = "Belirtilmemiş";
    let ingredients = [];

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
      ingredients = product.ingredientsSummary.length > 0 ? product.ingredientsSummary : (product.rawIngredientsText || "").split(",");
    } else if (rawIngredientsText) {
      ingredients = rawIngredientsText.split(",");
    } else {
      throw new ValidationError("Lütfen barkod veya içerik metni sağlayın.");
    }

    // 3. Dermatolojik Uyumluluk Motorunu Çalıştır
    const report = SkinCompatibilityEngine.evaluate(skinProfile, ingredients);

    // 4. TTL Log Kaydı Aç
    if (this.scanLogRepository && barcode) {
      await this.scanLogRepository.logScan({
        userId,
        barcode,
        compatibilityScore: report.compatibilityScore
      });
    }

    return {
      product: {
        barcode,
        productName,
        brandName
      },
      userProfile: {
        skinType: skinProfile.skinType,
        conditions: skinProfile.conditions
      },
      evaluation: report
    };
  }
}

module.exports = CompatibilityService;
