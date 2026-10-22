// src/modules/analysis/domain/services/IngredientConflictEngine.js - Kimyasal Çakışma ve Bariyer Koruma Motoru (SOLID - SRP & Strategy)
// Gerekçe: Kozmetik aktif içeriklerin birbiriyle geçimsizliğini, bariyer hasarı ve pH çakışması risklerini hesaplar.

class IngredientConflictEngine {
  constructor() {
    this.conflictRules = [
      {
        id: "RETINOID_AND_DIRECT_ACIDS",
        title: "Retinoid + AHA/BHA Asit Çakışması",
        severity: "HIGH", // HIGH, MEDIUM, LOW
        groupAName: "Retinoidler",
        groupBName: "AHA / BHA Kimyasal Asitler",
        groupAPattern: /\b(retinol|retinal|retinaldehyde|tretinoin|adapalene|retinyl\s+palmitate|hydroxypinacolone\s+retinoate)\b/i,
        groupBPattern: /\b(glycolic\s+acid|salicylic\s+acid|lactic\s+acid|mandelic\s+acid|tartaric\s+acid|malic\s+acid|gluconolactone|lactobionic\s+acid)\b/i,
        description: "Retinol ve kimyasal soyucu asitler (AHA/BHA) aynı anda uygulandığında cilt bariyerini aşırı zorlayarak şiddetli yanma, kızarıklık ve pullanmaya neden olabilir.",
        dermatologistAdvice: "Bu iki aktifi aynı rutinde üst üste sürmeyiniz. Asitleri sabah (güneş kremiyle), Retinolü ise akşam uygulayabilir veya haftalık 'Skin Cycling' rutiniyle farklı günlerde dönüşümlü kullanabilirsiniz."
      },
      {
        id: "RETINOID_AND_BENZOYL_PEROXIDE",
        title: "Retinoid + Benzoil Peroksit Etkisizleşmesi",
        severity: "HIGH",
        groupAName: "Retinoidler",
        groupBName: "Benzoil Peroksit",
        groupAPattern: /\b(retinol|retinal|retinyl\s+palmitate|tretinoin)\b/i,
        groupBPattern: /\b(benzoyl\s+peroxide)\b/i,
        description: "Benzoil peroksit kuvvetli bir oksitleyicidir ve retinoid molekülünün yapısını parçalayarak etkisizleştirebilir; aynı zamanda aşırı kuruluk ve tahriş yaratır.",
        dermatologistAdvice: "Benzoil peroksiti sabah leke/akne üzerine bölgesel, retinoidi ise akşam tüm yüze uygulayınız."
      },
      {
        id: "PURE_VITAMIN_C_AND_DIRECT_ACIDS",
        title: "Saf C Vitamini (L-Ascorbic Acid) + AHA/BHA Aşırı Asit Yüklemesi",
        severity: "MEDIUM",
        groupAName: "Saf C Vitamini (Askorbik Asit)",
        groupBName: "AHA / BHA Asitler",
        groupAPattern: /\b(ascorbic\s+acid|l-ascorbic\s+acid)\b/i,
        groupBPattern: /\b(glycolic\s+acid|salicylic\s+acid|lactic\s+acid)\b/i,
        description: "Saf Askorbik Asit ve peeling asitlerinin her ikisi de 3.5 altı düşük pH ister. İkisi aynı anda sürüldüğünde asit yüklemesi cildi tahriş edebilir.",
        dermatologistAdvice: "Saf C Vitaminini sabah antioksidan ve ışıltı için, AHA/BHA asitlerini ise akşam gözenek arındırma için tercih ediniz."
      },
      {
        id: "RETINOID_AND_PURE_VITAMIN_C",
        title: "Retinoid + Saf C Vitamini pH Uyuşmazlığı",
        severity: "MEDIUM",
        groupAName: "Retinoidler",
        groupBName: "Saf C Vitamini",
        groupAPattern: /\b(retinol|retinal|tretinoin|hydroxypinacolone\s+retinoate)\b/i,
        groupBPattern: /\b(ascorbic\s+acid|l-ascorbic\s+acid)\b/i,
        description: "C Vitamini düşük pH'ta çalışırken, Retinoidler nötr pH'ta daha stabildir. Peş peşe sürüldüklerinde birbirlerinin emilimini ve etkinliğini düşürebilir.",
        dermatologistAdvice: "En ideal dermatolojik protokol: Sabah Saf C Vitamini + Güneş Kremi, Akşam ise Retinoid kullanımıdır."
      },
      {
        id: "COPPER_PEPTIDES_AND_DIRECT_ACIDS_OR_VIT_C",
        title: "Bakır Peptitleri + Asit / Saf C Vitamini Bozulması",
        severity: "MEDIUM",
        groupAName: "Bakır Peptitleri",
        groupBName: "Asitler ve Saf C Vitamini",
        groupAPattern: /\b(copper\s+tripeptide-1|bis\(tripeptide-1\)\s+copper\s+acetate)\b/i,
        groupBPattern: /\b(ascorbic\s+acid|glycolic\s+acid|salicylic\s+acid|lactic\s+acid)\b/i,
        description: "Asidik ortam bakır peptitlerindeki şelat bağlarını kırarak peptitin hücresel onarım gücünü yitirmesine ve serbest bakır salınımına yol açabilir.",
        dermatologistAdvice: "Bakır peptit serumunuzu hyaluronik asit veya niasinamid gibi nötr ürünlerle eşleştirin; asit ve C vitamininden ayrı rutinde tutun."
      },
      {
        id: "HIGH_NIACINAMIDE_AND_PURE_ACID",
        title: "Yüksek Niasinamid + Saf Askorbik Asit / Güçlü Asitler",
        severity: "LOW",
        groupAName: "Niasinamid",
        groupBName: "Saf Askorbik Asit / Güçlü Asit",
        groupAPattern: /\b(niacinamide)\b/i,
        groupBPattern: /\b(ascorbic\s+acid|glycolic\s+acid)\b/i,
        description: "Düşük pH'lı saf asitlerle yüksek konsantrasyonda niasinamid birleştiğinde niasin oluşumu tetiklenebilir; bu durum geçici kızarıklık ve sıcaklık hissi (flushing) yapabilir.",
        dermatologistAdvice: "Hassas ve rozaseaya yatkın bir cildiniz varsa iki ürün arasında en az 15-20 dakika bekleyiniz veya sabah/akşam olarak paylaştırınız."
      }
    ];
  }

  /**
   * Verilen içerik listesini veya birden fazla ürünün içeriklerini kimyasal çakışmalar açısından inceler
   * @param {Array<string> | string} inputA - İlk ürünün içerik dizisi veya metni
   * @param {Array<string> | string} [inputB=null] - İkinci ürünün içerik dizisi veya metni (karşılaştırma modu)
   * @returns {{
   *   hasConflicts: boolean,
   *   conflictCount: number,
   *   overallRisk: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH',
   *   conflicts: Array<{
   *     ruleId: string,
   *     title: string,
   *     severity: 'LOW' | 'MEDIUM' | 'HIGH',
   *     triggerA: string,
   *     triggerB: string,
   *     description: string,
   *     dermatologistAdvice: string
   *   }>
   * }}
   */
  detectConflicts(inputA, inputB = null) {
    const listA = this._normalizeInput(inputA);
    const listB = inputB ? this._normalizeInput(inputB) : null;

    const detectedConflicts = [];

    for (const rule of this.conflictRules) {
      if (listB) {
        // Karşılaştırma Modu: Ürün A vs Ürün B
        const aHasGroupA = this._findMatch(listA, rule.groupAPattern);
        const bHasGroupB = this._findMatch(listB, rule.groupBPattern);

        if (aHasGroupA && bHasGroupB) {
          detectedConflicts.push({
            ruleId: rule.id,
            title: rule.title,
            severity: rule.severity,
            triggerA: aHasGroupA,
            triggerB: bHasGroupB,
            description: rule.description,
            dermatologistAdvice: rule.dermatologistAdvice
          });
          continue;
        }

        const bHasGroupA = this._findMatch(listB, rule.groupAPattern);
        const aHasGroupB = this._findMatch(listA, rule.groupBPattern);

        if (bHasGroupA && aHasGroupB) {
          detectedConflicts.push({
            ruleId: rule.id,
            title: rule.title,
            severity: rule.severity,
            triggerA: bHasGroupA,
            triggerB: aHasGroupB,
            description: rule.description,
            dermatologistAdvice: rule.dermatologistAdvice
          });
        }
      } else {
        // Tek Ürün veya Birleştirilmiş Rutin Listesi İçi Çakışma Kontrolü
        const matchedA = this._findMatch(listA, rule.groupAPattern);
        const matchedB = this._findMatch(listA, rule.groupBPattern);

        if (matchedA && matchedB && matchedA.toLowerCase() !== matchedB.toLowerCase()) {
          detectedConflicts.push({
            ruleId: rule.id,
            title: rule.title,
            severity: rule.severity,
            triggerA: matchedA,
            triggerB: matchedB,
            description: rule.description,
            dermatologistAdvice: rule.dermatologistAdvice
          });
        }
      }
    }

    // Genel Risk Seviyesi Belirleme
    let overallRisk = "SAFE";
    if (detectedConflicts.some((c) => c.severity === "HIGH")) {
      overallRisk = "HIGH";
    } else if (detectedConflicts.some((c) => c.severity === "MEDIUM")) {
      overallRisk = "MEDIUM";
    } else if (detectedConflicts.length > 0) {
      overallRisk = "LOW";
    }

    return {
      hasConflicts: detectedConflicts.length > 0,
      conflictCount: detectedConflicts.length,
      overallRisk,
      conflicts: detectedConflicts
    };
  }

  _findMatch(items, pattern) {
    for (const item of items) {
      if (pattern.test(item)) {
        return item;
      }
    }
    return null;
  }

  _normalizeInput(input) {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map((i) => (typeof i === "string" ? i.trim() : "")).filter(Boolean);
    }
    if (typeof input === "string") {
      return input
        .split(/[,;\n•·]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return [];
  }
}

module.exports = IngredientConflictEngine;
