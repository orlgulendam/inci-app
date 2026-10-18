// src/modules/personalization/domain/services/AiPrivacyGuard.js - KVKK & Gizlilik Koruyucusu (SRP)
// Gerekçe: Yapay zekaya ad, soyad, e-posta ve doktor tavsiyeleri asla gönderilmez; yalnızca teknik cilt parametreleri iletilir.
class AiPrivacyGuard {
  static sanitizeForAi(skinProfile) {
    if (!skinProfile) {
      return {
        skinType: "unknown",
        conditions: [],
        allergicIngredients: [],
        targetedBenefits: []
      };
    }

    return {
      skinType: skinProfile.skinType || "normal",
      conditions: Array.isArray(skinProfile.conditions) ? [...skinProfile.conditions] : [],
      allergicIngredients: Array.isArray(skinProfile.allergicIngredients) ? [...skinProfile.allergicIngredients] : [],
      targetedBenefits: Array.isArray(skinProfile.targetedBenefits) ? [...skinProfile.targetedBenefits] : []
      // DİKKAT: firstName, lastName, email, dermatologistNotes, routineMedications KESİNLİKLE DAHİL EDİLMEZ.
    };
  }
}

module.exports = AiPrivacyGuard;
