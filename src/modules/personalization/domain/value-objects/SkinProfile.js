// src/modules/personalization/domain/value-objects/SkinProfile.js - Cilt Profili Değer Nesnesi
// KVKK Madde 6: Bu sınıftaki veriler Özel Nitelikli Kişisel Sağlık Verisi statüsündedir.

class SkinProfile {
  constructor(data = {}) {
    const opts = data || {};
    const skinType = opts.skinType || "combination";
    const conditions = opts.conditions || [];
    const allergicIngredients = opts.allergicIngredients || [];
    const frequentlyUsedProducts = opts.frequentlyUsedProducts || [];
    const routineMedications = opts.routineMedications || [];
    const dermatologistNotes = opts.dermatologistNotes || [];
    const targetedBenefits = opts.targetedBenefits || [];

    const validSkinTypes = ["dry", "oily", "combination", "normal", "sensitive"];
    this.skinType = validSkinTypes.includes(skinType) ? skinType : "combination";

    this.conditions = Array.isArray(conditions)
      ? Array.from(new Set(conditions.map(c => String(c).toLowerCase().trim())))
      : [];

    this.allergicIngredients = Array.isArray(allergicIngredients)
      ? Array.from(new Set(allergicIngredients.map(i => String(i).toUpperCase().trim())))
      : [];

    this.frequentlyUsedProducts = Array.isArray(frequentlyUsedProducts)
      ? frequentlyUsedProducts.map(p => String(p).trim()).filter(Boolean)
      : [];

    this.routineMedications = Array.isArray(routineMedications)
      ? routineMedications.map(m => String(m).trim()).filter(Boolean)
      : [];

    this.dermatologistNotes = Array.isArray(dermatologistNotes)
      ? dermatologistNotes.map(n => ({
          note: typeof n === "string" ? n : (n.note || ""),
          date: n.date || new Date().toISOString()
        })).filter(n => n.note.length > 0)
      : [];

    this.targetedBenefits = Array.isArray(targetedBenefits)
      ? Array.from(new Set(targetedBenefits.map(b => String(b).toLowerCase().trim())))
      : [];

    this.completionPercentage = this.calculateCompletionPercentage();

    Object.freeze(this.conditions);
    Object.freeze(this.allergicIngredients);
    Object.freeze(this.frequentlyUsedProducts);
    Object.freeze(this.routineMedications);
    Object.freeze(this.dermatologistNotes);
    Object.freeze(this.targetedBenefits);
    Object.freeze(this);
  }

  calculateCompletionPercentage() {
    let score = 20; // skinType her zaman var
    if (this.conditions.length > 0) score += 20;
    if (this.allergicIngredients.length > 0) score += 15;
    if (this.targetedBenefits.length > 0) score += 15;
    if (this.frequentlyUsedProducts.length > 0) score += 15;
    if (this.routineMedications.length > 0 || this.dermatologistNotes.length > 0) score += 15;
    return Math.min(100, score);
  }

  hasCondition(condition) {
    return this.conditions.includes(condition.toLowerCase());
  }

  isAllergicTo(inciName) {
    if (!inciName) return false;
    const target = inciName.toUpperCase().trim();
    return this.allergicIngredients.some(item => target.includes(item) || item.includes(target));
  }
}

module.exports = SkinProfile;
