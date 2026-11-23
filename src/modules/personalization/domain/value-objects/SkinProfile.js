// src/modules/personalization/domain/value-objects/SkinProfile.js - Cilt Profili Değer Nesnesi
// KVKK Madde 6: Bu sınıftaki veriler Özel Nitelikli Kişisel Sağlık Verisi statüsündedir.

// Arayüz cilt tipini Türkçe gönderiyor, domain İngilizce sabitler kullanıyor.
// Eşleme olmadan "kuru"/"yagli"/"hassas" sessizce "combination"a düşüyor ve
// kullanıcının gerçek cilt tipi analiz motoruna hiç ulaşmıyordu.
const SKIN_TYPE_MAP = {
  kuru: "dry",
  yagli: "oily",
  karma: "combination",
  hassas: "sensitive",
  normal: "normal",
  dry: "dry",
  oily: "oily",
  combination: "combination",
  sensitive: "sensitive"
};

// Arayüzdeki alerjen çipleri grup adıdır ("Parabens", "Sulfates (SLS/SLES)").
// Bunlar INCI adlarıyla birebir eşleşmediği için alerjen uyarıları hiç tetiklenmiyordu.
const ALLERGEN_GROUPS = [
  { key: "PARABENS", selects: /PARABEN/, matches: /PARABEN/ },
  { key: "SULFATES", selects: /SULFATE|SULFAT|SLS|SLES/, matches: /(LAURYL|LAURETH|MYRETH|COCETH|AMMONIUM)\s*SULFATE/ },
  { key: "FRAGRANCE", selects: /FRAGRANCE|PARFUM|KOKU/, matches: /PARFUM|FRAGRANCE|AROMA/ },
  { key: "ALCOHOL", selects: /^ALCOHOL|ALKOL/, matches: /ALCOHOL DENAT|^SD ALCOHOL|^ALCOHOL$/ },
  { key: "ESSENTIAL_OILS", selects: /ESSENTIAL OIL|UCUCU YAG/, matches: /ESSENTIAL OIL|\bOIL$/ }
];

function normalizeTurkish(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

class SkinProfile {
  constructor(data = {}) {
    const opts = data || {};
    const conditions = opts.conditions || [];
    const allergicIngredients = opts.allergicIngredients || [];
    const frequentlyUsedProducts = opts.frequentlyUsedProducts || [];
    const routineMedications = opts.routineMedications || [];
    const dermatologistNotes = opts.dermatologistNotes;
    const targetedBenefits = opts.targetedBenefits || [];

    this.skinType = SKIN_TYPE_MAP[normalizeTurkish(opts.skinType)] || "combination";

    this.conditions = Array.isArray(conditions)
      ? Array.from(new Set(conditions.map(c => normalizeTurkish(c)).filter(Boolean)))
      : [];

    this.allergicIngredients = Array.isArray(allergicIngredients)
      ? Array.from(new Set(allergicIngredients.map(i => String(i).toUpperCase().trim()).filter(Boolean)))
      : [];

    this.frequentlyUsedProducts = Array.isArray(frequentlyUsedProducts)
      ? frequentlyUsedProducts.map(p => String(p).trim()).filter(Boolean)
      : [];

    this.routineMedications = Array.isArray(routineMedications)
      ? routineMedications.map(m => String(m).trim()).filter(Boolean)
      : [];

    // Arayüz dermatologistNotes'u düz metin gönderiyor; yalnızca dizi kabul etmek
    // her kayıtta kullanıcının doktor notunu sessizce siliyordu.
    this.dermatologistNotes = SkinProfile.normalizeNotes(dermatologistNotes);

    this.targetedBenefits = Array.isArray(targetedBenefits)
      ? Array.from(new Set(targetedBenefits.map(b => String(b).toLowerCase().trim()).filter(Boolean)))
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

  static normalizeNotes(input) {
    if (!input) return [];
    const list = Array.isArray(input) ? input : [input];
    return list
      .map(n => ({
        note: typeof n === "string" ? n.trim() : String((n && n.note) || "").trim(),
        date: (n && n.date) || new Date().toISOString()
      }))
      .filter(n => n.note.length > 0);
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
    return this.conditions.includes(normalizeTurkish(condition));
  }

  isAllergicTo(inciName) {
    if (!inciName) return false;
    const target = String(inciName).toUpperCase().trim();

    return this.allergicIngredients.some(item => {
      // 1) Grup çipi mi? ("Parabens" -> METHYLPARABEN, "Sulfates (SLS/SLES)" -> SODIUM LAURETH SULFATE)
      const group = ALLERGEN_GROUPS.find(g => g.selects.test(item));
      if (group && group.matches.test(target)) return true;

      // 2) Doğrudan ad eşleşmesi
      return target.includes(item) || item.includes(target);
    });
  }
}

module.exports = SkinProfile;
