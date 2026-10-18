// src/modules/personalization/domain/services/SkinCompatibilityEngine.js - Cilt Uyumluluk Motoru (Domain Service)
// Gerekçe: Kozmetik kimyası ile dermatolojik cilt profili arasındaki uyumluluk kurallarını saf iş mantığında işletir.

class SkinCompatibilityEngine {
  static evaluate(skinProfile, ingredientsList = []) {
    const warnings = [];
    let riskPoints = 0;

    const ingNames = ingredientsList.map(item => {
      const name = typeof item === "string" ? item : (item.inciName || item.clean || item.raw || "");
      return name.toUpperCase().trim();
    });

    for (const ing of ingNames) {
      if (!ing) continue;

      // 1. KURAL: Kullanıcının Şahsi Alerjen Listesi (En Yüksek Risk)
      if (skinProfile.isAllergicTo(ing)) {
        warnings.push({
          type: "PERSONAL_ALLERGEN",
          severity: "CRITICAL",
          ingredient: ing,
          message: `DİKKAT: Cilt profilinizde bizzat alerjiniz olduğunu belirttiğiniz '${ing}' maddesi bu üründe bulunuyor!`
        });
        riskPoints += 50;
      }

      // 2. KURAL: Parfüm / Koku Hassasiyeti
      if (skinProfile.hasCondition("fragrance_sensitive") || skinProfile.skinType === "sensitive") {
        if (ing === "PARFUM" || ing === "FRAGRANCE" || ing === "LINALOOL" || ing === "LIMONENE" || ing === "GERANIOL" || ing === "CITRONELLOL") {
          warnings.push({
            type: "FRAGRANCE_RISK",
            severity: "HIGH",
            ingredient: ing,
            message: `Hassas/kokuya duyarlı cildiniz için '${ing}' maddesi iritasyon veya kızarıklık tetikleyebilir.`
          });
          riskPoints += 15;
        }
      }

      // 3. KURAL: Egzama / Hasarlı Cilt Bariyeri
      if (skinProfile.hasCondition("eczema")) {
        if (ing.includes("SULFATE") || ing.includes("SODIUM LAURYL") || ing === "ALCOHOL DENAT." || ing === "ALCOHOL DENAT") {
          warnings.push({
            type: "BARRIER_STRIPPING_RISK",
            severity: "HIGH",
            ingredient: ing,
            message: `Egzama eğilimli cilt bariyerini kurutabilecek ve soyabilecek sert madde: '${ing}'.`
          });
          riskPoints += 20;
        }
      }

      // 4. KURAL: Mantar Aknesi (Malassezia Folliculitis)
      if (skinProfile.hasCondition("fungal_acne")) {
        const isTrigger =
          ing.includes("OIL") ||
          ing.includes("STEARATE") ||
          ing.includes("PALMITATE") ||
          ing.includes("POLYSORBATE") ||
          ing === "OLEIC ACID" ||
          ing === "LINOLEIC ACID";

        // Skualen ve Mineral yağ istisnadır, diğer yağlar mantar aknesini besler
        if (isTrigger && !ing.includes("SQUALANE") && !ing.includes("MINERAL OIL")) {
          warnings.push({
            type: "FUNGAL_ACNE_TRIGGER",
            severity: "HIGH",
            ingredient: ing,
            message: `Mantar aknesini (Malassezia) besleyebilecek lipid/yağ türevi: '${ing}'.`
          });
          riskPoints += 15;
        }
      }

      // 5. KURAL: Roza (Gül Hastalığı)
      if (skinProfile.hasCondition("rosacea")) {
        if (ing.includes("MENTHOL") || ing.includes("EUCALYPTUS") || ing.includes("CAMPHOR") || ing.includes("WITCH HAZEL")) {
          warnings.push({
            type: "ROSACEA_FLARE_TRIGGER",
            severity: "MEDIUM",
            ingredient: ing,
            message: `Roza kılcal damarlarını genişletip kızarıklık atağı yapabilecek madde: '${ing}'.`
          });
          riskPoints += 15;
        }
      }

      // 6. KURAL: Komedojenik (Gözenek Tıkayıcı) Eğilim
      if (skinProfile.hasCondition("comedogenic_prone") || skinProfile.skinType === "oily") {
        if (ing === "ISOPROPYL MYRISTATE" || ing === "COCOS NUCIFERA OIL" || ing === "ETHYLHEXYL PALMITATE" || ing === "MYRISTYL MYRISTATE") {
          warnings.push({
            type: "PORE_CLOGGING_RISK",
            severity: "MEDIUM",
            ingredient: ing,
            message: `Akne ve siyah nokta eğilimli gözenekleri tıkama riski yüksek madde: '${ing}'.`
          });
          riskPoints += 10;
        }
      }
    }

    const compatibilityScore = Math.max(0, 100 - riskPoints);
    const isCompatible = compatibilityScore >= 70 && !warnings.some(w => w.severity === "CRITICAL");

    return {
      isCompatible,
      compatibilityScore,
      riskLevel: compatibilityScore >= 80 ? "LOW" : compatibilityScore >= 50 ? "MODERATE" : "HIGH",
      totalWarnings: warnings.length,
      warnings
    };
  }
}

module.exports = SkinCompatibilityEngine;
