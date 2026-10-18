// src/modules/analysis/application/services/AnalysisService.js - Analiz Koordinatörü (DIP & SRP)
// Gerekçe: IIngredientRepository arayüzü ve RegulationRule stratejileri Dependency Injection ile enjekte edilir.
const TokenizerService = require("./TokenizerService");
const SafetyScore = require("../../domain/value-objects/SafetyScore");
const {
  BannedIngredientRule,
  RestrictedIngredientRule,
  AllergenRule,
  PreservativeRule,
  ColorantRule,
  UvFilterRule
} = require("../../domain/rules/RegulationRule");

class AnalysisService {
  constructor(ingredientRepository, rules = null) {
    this.ingredientRepository = ingredientRepository;
    this.rules = rules || [
      new BannedIngredientRule(),
      new RestrictedIngredientRule(),
      new AllergenRule(),
      new PreservativeRule(),
      new ColorantRule(),
      new UvFilterRule()
    ];
  }

  async resolveToken(rawToken) {
    const clean = TokenizerService.cleanToken(rawToken);
    if (!clean || clean.length < 2) return null;

    // 1. Doğrudan tam ad ile ara
    let matched = await this.ingredientRepository.findByInciName(clean);
    if (matched) return { raw: rawToken, clean, ingredient: matched, method: "exact" };

    // 2. Parantez içi / dışı ayrıştırma (Örn: "Water (Aqua)" -> Aqua veya "Extract (Plant)" -> Extract)
    const pMatch = clean.match(/^([^(]+)\s*\(([^)]+)\)\s*(.*)$/);
    if (pMatch) {
      const before = pMatch[1].trim();
      const inside = pMatch[2].trim();
      const after = pMatch[3].trim();

      // Deneme A: Parantez dışı
      const outerName = (before + " " + after).trim();
      matched = await this.ingredientRepository.findByInciName(outerName);
      if (matched) return { raw: rawToken, clean, ingredient: matched, method: "outer_parens" };

      // Deneme B: Parantez içi
      matched = await this.ingredientRepository.findByInciName(inside);
      if (matched) return { raw: rawToken, clean, ingredient: matched, method: "inner_parens" };
    }

    // 3. CI Renk Kodu kontrolü (Örn: "Iron Oxides CI 77491" -> "CI 77491")
    const ciMatch = clean.match(/\bci\s*(\d{5})\b/i);
    if (ciMatch) {
      matched = await this.ingredientRepository.findByInciName("CI " + ciMatch[1]);
      if (matched) return { raw: rawToken, clean, ingredient: matched, method: "ci_code" };
    }

    // 4. Slash (/) ile ayrılmış maddeler
    if (clean.includes("/")) {
      for (const seg of clean.split("/")) {
        matched = await this.ingredientRepository.findByInciName(seg.trim());
        if (matched) return { raw: rawToken, clean, ingredient: matched, method: "slash_split" };
      }
    }

    return { raw: rawToken, clean, ingredient: null, method: "unmatched" };
  }

  async analyze(rawText) {
    const tokens = TokenizerService.split(rawText);
    const resolvedItems = [];
    const unknown = [];

    const flags = {
      banned: [],
      restricted: [],
      allergens: [],
      preservatives: [],
      colorants: [],
      uvFilters: []
    };

    for (const token of tokens) {
      const item = await this.resolveToken(token);
      if (!item) continue;
      resolvedItems.push(item);

      if (!item.ingredient) {
        unknown.push(item.clean);
        continue;
      }

      const ing = item.ingredient;

      // Strateji Kurallarını Çalıştır
      for (const rule of this.rules) {
        const result = rule.evaluate(ing);
        if (result.triggered) {
          const detail = {
            inciName: ing.inciName,
            raw: item.raw,
            reference: result.reference,
            message: result.message
          };
          if (result.type === "banned") flags.banned.push(detail);
          if (result.type === "restricted") flags.restricted.push(detail);
          if (result.type === "allergen") flags.allergens.push(detail);
          if (result.type === "preservative") flags.preservatives.push(detail);
          if (result.type === "colorant") flags.colorants.push(detail);
          if (result.type === "uv_filter") flags.uvFilters.push(detail);
        }
      }
    }

    // Değer Nesnesi ile Güvenlik Skoru Hesapla
    const safetyScore = SafetyScore.calculate({
      total: tokens.length,
      matched: tokens.length - unknown.length,
      bannedCount: flags.banned.length,
      restrictedCount: flags.restricted.length,
      allergenCount: flags.allergens.length,
      unknownCount: unknown.length
    });

    return {
      summary: {
        totalIngredients: tokens.length,
        matchedIngredients: tokens.length - unknown.length,
        unknownIngredients: unknown.length,
        score: safetyScore.score,
        status: safetyScore.status,
        isClean: safetyScore.isClean,
        breakdown: safetyScore.breakdown
      },
      flags,
      unknown,
      items: resolvedItems.map(it => {
        const ing = it.ingredient;
        return {
          raw: it.raw,
          clean: it.clean,
          matched: !!ing,
          inciName: ing ? ing.inciName : it.clean.toUpperCase(),
          casNumber: ing ? ing.casNumber : null,
          functions: ing ? ing.functions : [],
          functionsTr: ing ? ing.functionsTr : [],
          noteTr: ing ? ing.noteTr : null,
          badges: ing ? {
            isBanned: ing.isBanned(),
            isRestricted: ing.isRestricted(),
            isAllergen: ing.isAllergen(),
            isPreservative: ing.isPreservative(),
            isColorant: ing.isColorant(),
            isUvFilter: ing.isUvFilter()
          } : null
        };
      })
    };
  }
}

module.exports = AnalysisService;
