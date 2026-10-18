// src/modules/analysis/domain/entities/Ingredient.js - Saf Domain Entity
// Hiçbir dış veritabanı veya web kütüphanesine bağımlı değildir.

class Ingredient {
  constructor({
    id = null,
    inciName,
    casNumber = null,
    functions = [],
    functionsTr = [],
    flags = {},
    euAnnex = {},
    noteTr = null
  }) {
    if (!inciName || typeof inciName !== "string") {
      throw new Error("Ingredient entity requires a valid inciName");
    }

    this.id = id;
    this.inciName = inciName.toUpperCase().trim();
    this.casNumber = casNumber;
    this.functions = Array.isArray(functions) ? functions : [];
    this.functionsTr = Array.isArray(functionsTr) ? functionsTr : [];
    this.flags = {
      banned: !!flags.banned,
      restricted: !!flags.restricted,
      allergen: !!flags.allergen
    };
    this.euAnnex = {
      annex2: euAnnex.annex2 || null, // Yasaklılar Listesi (Banned)
      annex3: euAnnex.annex3 || null, // Kısıtlılar Listesi (Restricted)
      preservative: euAnnex.preservative || null, // Annex V (Koruyucu)
      colorant: euAnnex.colorant || null, // Annex IV (Renklendirici)
      uvFilter: euAnnex.uv_filter || euAnnex.uvFilter || null // Annex VI (Güneş Filtresi)
    };
    this.noteTr = noteTr;
  }

  isBanned() {
    return this.flags.banned;
  }

  isRestricted() {
    return this.flags.restricted;
  }

  isAllergen() {
    return this.flags.allergen;
  }

  isPreservative() {
    return !!(this.euAnnex.preservative && this.euAnnex.preservative.length);
  }

  isColorant() {
    return !!(this.euAnnex.colorant && this.euAnnex.colorant.length);
  }

  isUvFilter() {
    return !!(this.euAnnex.uvFilter && this.euAnnex.uvFilter.length);
  }
}

module.exports = Ingredient;
