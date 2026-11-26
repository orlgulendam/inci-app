// src/modules/analysis/domain/value-objects/SafetyScore.js - Güvenlik Skoru Değer Nesnesi (Value Object)
// Değişmezdir (immutable) ve kendi içinde hesaplama mantığını barındırır.

// Formül hakkında yeterli veri yokken verilebilecek en yüksek puan (CAUTION sınırı).
const INSUFFICIENT_DATA_SCORE = 50;

class SafetyScore {
  constructor({ score, status, isClean, breakdown }) {
    this.score = Math.max(0, Math.min(100, Math.round(score)));
    this.status = status; // "CLEAN" | "CAUTION" | "HAZARDOUS"
    this.isClean = isClean;
    this.breakdown = Object.freeze({ ...breakdown });
    Object.freeze(this);
  }

  static calculate({ total, matched, bannedCount, restrictedCount, allergenCount, unknownCount } = {}) {
    // Eksik ya da sayı olmayan sayımlar aritmetiği NaN'a çeviriyordu; NaN puan
    // Math.max/min/round zincirinden de temizlenmediği için istemciye "CLEAN" ve
    // isClean: true ile birlikte geçerli görünen bozuk bir skor gidiyordu.
    const toCount = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    };

    const totalCount = toCount(total);
    const banned = toCount(bannedCount);
    const restricted = toCount(restrictedCount);
    const allergens = toCount(allergenCount);
    const unknown = toCount(unknownCount);

    // 1. Yasaklı madde varsa ürün derhal güvensizdir (Puan: 0)
    if (banned > 0) {
      return new SafetyScore({
        score: 0,
        status: "HAZARDOUS",
        isClean: false,
        breakdown: {
          bannedPenalty: 100,
          restrictedPenalty: 0,
          allergenPenalty: 0,
          unknownPenalty: 0
        }
      });
    }

    let currentScore = 100;
    const restrictedPenalty = restricted * 15;
    const allergenPenalty = allergens * 6;
    const unknownPenalty = Math.min(20, unknown * 2);

    currentScore -= (restrictedPenalty + allergenPenalty + unknownPenalty);
    let finalScore = Math.max(10, Math.min(100, currentScore));

    // Veri yetersizliği: bileşenlerin yarısından fazlası sözlükte tanınmadıysa ya da
    // hiç bileşen yoksa formül hakkında güvenli bir yargıya varılamaz. Tanınmayan
    // madde cezası 20 puanda tavan yaptığı için puan bunu tek başına yansıtmıyordu;
    // hakkında hiçbir şey bilinmeyen bir formül 80/CLEAN, boş liste ise 100/CLEAN
    // olarak sunuluyordu. Böyle bir sonuç asla "temiz" sayılmaz ve puan, durumla
    // tutarlı olması için CAUTION sınırına (50) çekilir.
    const hasInsufficientData = totalCount === 0 || unknown * 2 > totalCount;
    if (hasInsufficientData) {
      finalScore = Math.min(finalScore, INSUFFICIENT_DATA_SCORE);
    }

    let status = "CLEAN";
    let isClean = true;

    if (finalScore < 50 || restricted > 2) {
      status = "HAZARDOUS";
      isClean = false;
    } else if (finalScore < 80 || allergens > 0 || restricted > 0 || hasInsufficientData) {
      status = "CAUTION";
      isClean = false;
    }

    return new SafetyScore({
      score: finalScore,
      status,
      isClean,
      breakdown: {
        restrictedPenalty,
        allergenPenalty,
        unknownPenalty
      }
    });
  }
}

module.exports = SafetyScore;
