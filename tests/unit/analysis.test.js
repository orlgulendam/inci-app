// tests/unit/analysis.test.js - Analysis Modülü Birim ve Entegrasyon Testleri
const test = require("node:test");
const assert = require("node:assert/strict");

const TokenizerService = require("../../src/modules/analysis/application/services/TokenizerService");
const SafetyScore = require("../../src/modules/analysis/domain/value-objects/SafetyScore");
const Ingredient = require("../../src/modules/analysis/domain/entities/Ingredient");
const {
  BannedIngredientRule,
  RestrictedIngredientRule,
  AllergenRule
} = require("../../src/modules/analysis/domain/rules/RegulationRule");
const AnalysisService = require("../../src/modules/analysis/application/services/AnalysisService");
const IIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/IIngredientRepository");
const app = require("../../src/app");

// 1. Tokenizer Testi (SRP)
test("Analysis: Tokenizer kimyasal virgülleri ve CI kodlarını doğru ayrıştırmalı", () => {
  const raw = "Ingredients: Aqua, 1,2-Hexanediol, Glycerin, Iron Oxides (CI 77491, CI 77492), Parfum (Fragrance)";
  const tokens = TokenizerService.split(raw);

  assert.ok(tokens.includes("Aqua"));
  assert.ok(tokens.includes("1,2-Hexanediol"), "Kimyasal virgül korunmalı");
  assert.ok(tokens.includes("Glycerin"));
  assert.ok(tokens.includes("CI 77491"), "CI kodları ayrışmalı");
  assert.ok(tokens.includes("CI 77492"), "CI kodları ayrışmalı");
  assert.ok(tokens.includes("Parfum (Fragrance)"));
});

// 2. SafetyScore Value Object Testi
test("Analysis: SafetyScore yasaklı maddede 0 dönmeli, temiz üründe 80+ dönmeli", () => {
  // A) Temiz formül
  const cleanScore = SafetyScore.calculate({
    total: 10,
    matched: 10,
    bannedCount: 0,
    restrictedCount: 0,
    allergenCount: 0,
    unknownCount: 0
  });
  assert.equal(cleanScore.score, 100);
  assert.equal(cleanScore.status, "CLEAN");
  assert.equal(cleanScore.isClean, true);

  // B) Yasaklı madde içeren formül (Kritik regülasyon kuralı)
  const bannedScore = SafetyScore.calculate({
    total: 10,
    matched: 10,
    bannedCount: 1,
    restrictedCount: 0,
    allergenCount: 1,
    unknownCount: 0
  });
  assert.equal(bannedScore.score, 0);
  assert.equal(bannedScore.status, "HAZARDOUS");
  assert.equal(bannedScore.isClean, false);

  // C) Alerjen içeren formül (Dikkat durumu)
  const allergenScore = SafetyScore.calculate({
    total: 10,
    matched: 10,
    bannedCount: 0,
    restrictedCount: 0,
    allergenCount: 2,
    unknownCount: 0
  });
  assert.ok(allergenScore.score < 100);
  assert.equal(allergenScore.status, "CAUTION");
  assert.equal(allergenScore.isClean, false);
});

// 3. Regülasyon Kural Stratejileri Testi (Strategy Pattern)
test("Analysis: Strateji kuralları (RegulationRule) doğru bayrakları tetiklemeli", () => {
  const bannedIng = new Ingredient({
    inciName: "LILIAL",
    flags: { banned: true, restricted: false, allergen: true },
    euAnnex: { annex2: "Ref 1380" }
  });

  const bannedRule = new BannedIngredientRule();
  const allergenRule = new AllergenRule();

  const resBanned = bannedRule.evaluate(bannedIng);
  assert.equal(resBanned.triggered, true);
  assert.equal(resBanned.severity, "critical");

  const resAllergen = allergenRule.evaluate(bannedIng);
  assert.equal(resAllergen.triggered, true);
});

// 4. AnalysisService & Mock Repository Testi (DIP - Dependency Inversion)
class MockIngredientRepository extends IIngredientRepository {
  constructor(data) {
    super();
    this.data = new Map(Object.entries(data));
  }

  async findByInciName(name) {
    const key = name.toUpperCase().trim();
    return this.data.get(key) || null;
  }

  async search(query) {
    return Array.from(this.data.values()).filter(i => i.inciName.includes(query.toUpperCase()));
  }

  async bulkFindByInciNames(names) {
    const res = new Map();
    for (const n of names) {
      const hit = await this.findByInciName(n);
      if (hit) res.set(n, hit);
    }
    return res;
  }
}

test("Analysis: AnalysisService Mock Repository ile veritabanından bağımsız analiz yapabilmeli", async () => {
  const mockRepo = new MockIngredientRepository({
    "AQUA": new Ingredient({ inciName: "AQUA", functionsTr: ["Çözücü", "Nemlendirici"] }),
    "GLYCERIN": new Ingredient({ inciName: "GLYCERIN", functionsTr: ["Nem Tutucu"] }),
    "LINALOOL": new Ingredient({ inciName: "LINALOOL", flags: { allergen: true } }),
    "BUTYLPHENYL METHYLPROPIONAL": new Ingredient({ inciName: "BUTYLPHENYL METHYLPROPIONAL", flags: { banned: true } })
  });

  const service = new AnalysisService(mockRepo);
  const result = await service.analyze("Aqua, Glycerin, Linalool, Butylphenyl Methylpropional");

  assert.equal(result.summary.totalIngredients, 4);
  assert.equal(result.summary.matchedIngredients, 4);
  assert.equal(result.flags.banned.length, 1);
  assert.equal(result.flags.allergens.length, 1);
  assert.equal(result.summary.score, 0, "Yasaklı madde olduğundan puan 0 olmalı");
});

// 5. HTTP Entegrasyon Testleri (Supertest / fetch)
test("Analysis: POST /api/v1/analyze geçerli girdiyle 200 OK ve analiz özeti dönmeli", async () => {
  const server = app.listen(3097);
  try {
    const res = await fetch("http://localhost:3097/api/v1/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredientsText: "Aqua, Glycerin, Niacinamide, Parfum"
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.summary);
    assert.equal(body.data.summary.totalIngredients, 4);
    assert.ok(Array.isArray(body.data.items));
  } finally {
    server.close();
  }
});

test("Analysis: POST /api/v1/analyze boş metinle 400 VALIDATION_ERROR dönmeli", async () => {
  const server = app.listen(3096);
  try {
    const res = await fetch("http://localhost:3096/api/v1/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredientsText: ""
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "VALIDATION_ERROR");
  } finally {
    server.close();
  }
});
