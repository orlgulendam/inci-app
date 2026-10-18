// src/modules/analysis/domain/rules/RegulationRule.js - Strateji Deseni (Strategy Pattern)
// Gerekçe: Kozmetik regülasyon kurallarını (AB Annex II, III, V, VI, Alerjen) bağımsız sınıflara ayırarak OCP sağlamak.

class RegulationRule {
  getName() {
    throw new Error("Rule must implement getName()");
  }

  evaluate(ingredient) {
    throw new Error("Rule must implement evaluate(ingredient)");
  }
}

class BannedIngredientRule extends RegulationRule {
  getName() {
    return "ANNEX_II_BANNED";
  }

  evaluate(ingredient) {
    if (ingredient.isBanned()) {
      return {
        triggered: true,
        type: "banned",
        severity: "critical",
        message: "Bu bileşen AB Kozmetik Yönetmeliği Ek II kapsamında kesinlikle yasaklanmıştır.",
        reference: ingredient.euAnnex.annex2
      };
    }
    return { triggered: false };
  }
}

class RestrictedIngredientRule extends RegulationRule {
  getName() {
    return "ANNEX_III_RESTRICTED";
  }

  evaluate(ingredient) {
    if (ingredient.isRestricted()) {
      return {
        triggered: true,
        type: "restricted",
        severity: "warning",
        message: "Bu bileşen AB Yönetmeliği Ek III kapsamında belirli konsantrasyon kısıtlamalarına tabidir.",
        reference: ingredient.euAnnex.annex3
      };
    }
    return { triggered: false };
  }
}

class AllergenRule extends RegulationRule {
  getName() {
    return "ANNEX_III_FRAGRANCE_ALLERGEN";
  }

  evaluate(ingredient) {
    if (ingredient.isAllergen()) {
      return {
        triggered: true,
        type: "allergen",
        severity: "caution",
        message: "Zorunlu etiketlenmesi gereken 26 koku alerjeninden biridir.",
        reference: ingredient.euAnnex.annex3
      };
    }
    return { triggered: false };
  }
}

class PreservativeRule extends RegulationRule {
  getName() {
    return "ANNEX_V_PRESERVATIVE";
  }

  evaluate(ingredient) {
    if (ingredient.isPreservative()) {
      return {
        triggered: true,
        type: "preservative",
        severity: "info",
        message: "AB Ek V izinli koruyucu maddeler listesinde yer alır.",
        reference: ingredient.euAnnex.preservative
      };
    }
    return { triggered: false };
  }
}

class ColorantRule extends RegulationRule {
  getName() {
    return "ANNEX_IV_COLORANT";
  }

  evaluate(ingredient) {
    if (ingredient.isColorant()) {
      return {
        triggered: true,
        type: "colorant",
        severity: "info",
        message: "AB Ek IV izinli renklendirici (CI kodu) listesinde yer alır.",
        reference: ingredient.euAnnex.colorant
      };
    }
    return { triggered: false };
  }
}

class UvFilterRule extends RegulationRule {
  getName() {
    return "ANNEX_VI_UV_FILTER";
  }

  evaluate(ingredient) {
    if (ingredient.isUvFilter()) {
      return {
        triggered: true,
        type: "uv_filter",
        severity: "info",
        message: "AB Ek VI izinli ultraviyole güneş filtresi listesinde yer alır.",
        reference: ingredient.euAnnex.uvFilter
      };
    }
    return { triggered: false };
  }
}

module.exports = {
  RegulationRule,
  BannedIngredientRule,
  RestrictedIngredientRule,
  AllergenRule,
  PreservativeRule,
  ColorantRule,
  UvFilterRule
};
