// src/modules/analysis/domain/value-objects/SafetyScore.js - Güvenlik Skoru Değer Nesnesi (Value Object)
// Değişmezdir (immutable) ve kendi içinde hesaplama mantığını barındırır.

class SafetyScore {
  constructor({ score, status, isClean, breakdown }) {
    this.score = Math.max(0, Math.min(100, Math.round(score)));
    this.status = status; // "CLEAN" | "CAUTION" | "HAZARDOUS"
    this.isClean = isClean;
    this.breakdown = Object.freeze({ ...breakdown });
    Object.freeze(this);
  }

  static calculate({ total, matched, bannedCount, restrictedCount, allergenCount, unknownCount }) {
    // 1. Yasaklı madde varsa ürün derhal güvensizdir (Puan: 0)
    if (bannedCount > 0) {
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
    const restrictedPenalty = restrictedCount * 15;
    const allergenPenalty = allergenCount * 6;
    const unknownPenalty = Math.min(20, unknownCount * 2);

    currentScore -= (restrictedPenalty + allergenPenalty + unknownPenalty);
    const finalScore = Math.max(10, Math.min(100, currentScore));

    let status = "CLEAN";
    let isClean = true;

    if (finalScore < 50 || restrictedCount > 2) {
      status = "HAZARDOUS";
      isClean = false;
    } else if (finalScore < 80 || allergenCount > 0 || restrictedCount > 0) {
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
