// src/modules/personalization/domain/value-objects/SkinProfile.js - Cilt Profili Değer Nesnesi
// KVKK Madde 6: Bu sınıftaki veriler Özel Nitelikli Kişisel Sağlık Verisi statüsündedir.

class SkinProfile {
  constructor(data = {}) {
    const opts = data || {};
    const skinType = opts.skinType || "combination";
    const conditions = opts.conditions || [];
    const allergicIngredients = opts.allergicIngredients || [];

    const validSkinTypes = ["dry", "oily", "combination", "normal", "sensitive"];
    this.skinType = validSkinTypes.includes(skinType) ? skinType : "combination";

    this.conditions = Array.isArray(conditions)
      ? Array.from(new Set(conditions.map(c => String(c).toLowerCase().trim())))
      : [];

    this.allergicIngredients = Array.isArray(allergicIngredients)
      ? Array.from(new Set(allergicIngredients.map(i => String(i).toUpperCase().trim())))
      : [];

    Object.freeze(this.conditions);
    Object.freeze(this.allergicIngredients);
    Object.freeze(this);
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
