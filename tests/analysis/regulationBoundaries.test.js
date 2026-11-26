// tests/analysis/regulationBoundaries.test.js - Düzenleyici Bayrak Kuralları ve Sınır Değerleri
// Odak: Strateji deseniyle yazılmış altı RegulationRule sınıfının sözleşmesi (tetiklenme,
// tip, önem derecesi, referans aktarımı) ve yasaklı/kısıtlı sayısının durum eşiklerindeki
// sınır davranışı. Mevcut regulationFlags.test.js şema uyumunu (is_* / düz şema) kapsadığı
// için burada şema dönüşümü tekrar edilmez; kural katmanı ve eşikler ele alınır.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const AnalysisService = require("../../src/modules/analysis/application/services/AnalysisService");
const Ingredient = require("../../src/modules/analysis/domain/entities/Ingredient");
const MongoIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/MongoIngredientRepository");
const {
  RegulationRule,
  BannedIngredientRule,
  RestrictedIngredientRule,
  AllergenRule,
  PreservativeRule,
  ColorantRule,
  UvFilterRule
} = require("../../src/modules/analysis/domain/rules/RegulationRule");

const { normalizeKey } = MongoIngredientRepository;

function serviceWith(ingredients) {
  const byKey = new Map();
  for (const ingredient of ingredients) {
    byKey.set(normalizeKey(ingredient.inciName), ingredient);
  }
  return new AnalysisService({
    findByInciName: async (name) => byKey.get(normalizeKey(name)) || null
  });
}

// Belirtilen sayıda kısıtlı madde içeren formül üretir.
function restrictedFormula(count) {
  const names = Array.from({ length: count }, (_, i) => `RESTRICTIUM ${i + 1}`);
  const ingredients = [
    new Ingredient({ inciName: "AQUA" }),
    ...names.map((name) => new Ingredient({ inciName: name, flags: { restricted: true }, euAnnex: { annex3: `Ref ${name}` } }))
  ];
  return { text: ["Aqua", ...names].join(", "), service: serviceWith(ingredients) };
}

describe("Düzenleyici Kurallar: Soyut Sözleşme", () => {
  test("Temel RegulationRule sınıfı doğrudan kullanılamamalı", () => {
    const rule = new RegulationRule();

    assert.throws(() => rule.getName(), { message: "Rule must implement getName()" });
    assert.throws(() => rule.evaluate({}), { message: "Rule must implement evaluate(ingredient)" });
  });

  test("Altı kuralın tamamı kendine özgü mevzuat kimliği bildirmeli", () => {
    const names = [
      new BannedIngredientRule(),
      new RestrictedIngredientRule(),
      new AllergenRule(),
      new PreservativeRule(),
      new ColorantRule(),
      new UvFilterRule()
    ].map((rule) => rule.getName());

    assert.deepEqual(names, [
      "ANNEX_II_BANNED",
      "ANNEX_III_RESTRICTED",
      "ANNEX_III_FRAGRANCE_ALLERGEN",
      "ANNEX_V_PRESERVATIVE",
      "ANNEX_IV_COLORANT",
      "ANNEX_VI_UV_FILTER"
    ]);
    assert.equal(new Set(names).size, 6, "kural kimlikleri tekrar etmemeli");
  });

  test("Bayrağı olmayan bileşende hiçbir kural tetiklenmemeli", () => {
    const neutral = new Ingredient({ inciName: "AQUA" });

    const rules = [
      new BannedIngredientRule(),
      new RestrictedIngredientRule(),
      new AllergenRule(),
      new PreservativeRule(),
      new ColorantRule(),
      new UvFilterRule()
    ];

    for (const rule of rules) {
      assert.deepEqual(rule.evaluate(neutral), { triggered: false }, `${rule.getName()} tetiklenmemeli`);
    }
  });
});

describe("Düzenleyici Kurallar: Tetiklenme ve Önem Derecesi", () => {
  test("Yasaklı bileşen 'critical' önem derecesiyle tetiklenmeli", () => {
    const ingredient = new Ingredient({
      inciName: "MERCURY",
      flags: { banned: true },
      euAnnex: { annex2: "Ref 1" }
    });

    const result = new BannedIngredientRule().evaluate(ingredient);

    assert.equal(result.triggered, true);
    assert.equal(result.type, "banned");
    assert.equal(result.severity, "critical");
    assert.equal(result.reference, "Ref 1");
    assert.match(result.message, /Ek II/);
  });

  test("Kısıtlı bileşen 'warning', alerjen 'caution' derecesiyle tetiklenmeli", () => {
    const restricted = new Ingredient({ inciName: "HYDROQUINONE", flags: { restricted: true }, euAnnex: { annex3: "Ref 14" } });
    const allergen = new Ingredient({ inciName: "LINALOOL", flags: { allergen: true }, euAnnex: { annex3: "Ref 84" } });

    const restrictedResult = new RestrictedIngredientRule().evaluate(restricted);
    const allergenResult = new AllergenRule().evaluate(allergen);

    assert.equal(restrictedResult.severity, "warning");
    assert.equal(restrictedResult.type, "restricted");
    assert.equal(allergenResult.severity, "caution");
    assert.equal(allergenResult.type, "allergen");
  });

  test("Koruyucu, renklendirici ve UV filtresi kuralları 'info' derecesinde olmalı", () => {
    const ingredient = new Ingredient({
      inciName: "MULTI COMPOUND",
      euAnnex: { preservative: "Annex V 12", colorant: "Annex IV 77491", uv_filter: "Annex VI 28" }
    });

    const preservative = new PreservativeRule().evaluate(ingredient);
    const colorant = new ColorantRule().evaluate(ingredient);
    const uvFilter = new UvFilterRule().evaluate(ingredient);

    assert.equal(preservative.severity, "info");
    assert.equal(preservative.type, "preservative");
    assert.equal(colorant.type, "colorant");
    assert.equal(colorant.reference, "Annex IV 77491");
    assert.equal(uvFilter.type, "uv_filter");
    assert.equal(uvFilter.reference, "Annex VI 28");
  });

  test("Annex referansı eksik yasaklı bileşen de tetiklenmeli, referans null olmalı", () => {
    const result = new BannedIngredientRule().evaluate(new Ingredient({ inciName: "UNLISTED TOXIN", flags: { banned: true } }));

    assert.equal(result.triggered, true);
    assert.equal(result.reference, null, "referans yokken kural sessizce düşmemeli");
  });

  test("Tek bileşen aynı anda birden fazla kovaya bayraklanabilmeli", async () => {
    const service = serviceWith([
      new Ingredient({
        inciName: "OMNIFLAG COMPOUND",
        flags: { banned: true, restricted: true, allergen: true },
        euAnnex: { annex2: "A2", annex3: "A3", preservative: "A5", colorant: "A4", uv_filter: "A6" }
      })
    ]);

    const result = await service.analyze("Omniflag Compound");

    assert.equal(result.flags.banned.length, 1);
    assert.equal(result.flags.restricted.length, 1);
    assert.equal(result.flags.allergens.length, 1);
    assert.equal(result.flags.preservatives.length, 1);
    assert.equal(result.flags.colorants.length, 1);
    assert.equal(result.flags.uvFilters.length, 1);
    assert.deepEqual(result.items[0].badges, {
      isBanned: true,
      isRestricted: true,
      isAllergen: true,
      isPreservative: true,
      isColorant: true,
      isUvFilter: true
    });
  });
});

describe("Düzenleyici Bayraklar: Yasaklı Madde Baskınlığı", () => {
  test("Tek yasaklı madde diğer tüm cezaları ezip puanı 0'a çekmeli", async () => {
    const service = serviceWith([
      new Ingredient({ inciName: "AQUA" }),
      new Ingredient({ inciName: "BANNEDIUM", flags: { banned: true }, euAnnex: { annex2: "Ref 1" } }),
      new Ingredient({ inciName: "RESTRICTIUM", flags: { restricted: true } }),
      new Ingredient({ inciName: "ALLERGENIUM", flags: { allergen: true } })
    ]);

    const result = await service.analyze("Aqua, Bannedium, Restrictium, Allergenium");

    assert.equal(result.summary.score, 0);
    assert.equal(result.summary.status, "HAZARDOUS");
    assert.equal(result.summary.isClean, false);
    assert.equal(result.summary.breakdown.bannedPenalty, 100);
    assert.equal(result.summary.breakdown.restrictedPenalty, 0, "yasaklı madde varken diğer cezalar sıfırlanır");
  });

  test("Yasaklı madde listelenmeye devam etmeli, puan 0 olsa da bayraklar kaybolmamalı", async () => {
    const service = serviceWith([
      new Ingredient({ inciName: "BANNEDIUM", flags: { banned: true }, euAnnex: { annex2: "Ref 1" } }),
      new Ingredient({ inciName: "ALLERGENIUM", flags: { allergen: true } })
    ]);

    const result = await service.analyze("Bannedium, Allergenium");

    assert.equal(result.flags.banned.length, 1);
    assert.equal(result.flags.allergens.length, 1, "puan 0 olsa da alerjen listesi raporlanmalı");
  });
});

describe("Düzenleyici Bayraklar: Kısıtlı Madde Sayısı Sınır Değerleri", () => {
  test("Kısıtlı madde yoksa durum CLEAN olmalı", async () => {
    const { service, text } = restrictedFormula(0);
    const result = await service.analyze(text);

    assert.equal(result.summary.status, "CLEAN");
    assert.equal(result.summary.score, 100);
  });

  test("Bir ve iki kısıtlı maddede durum CAUTION'da kalmalı", async () => {
    for (const count of [1, 2]) {
      const { service, text } = restrictedFormula(count);
      const result = await service.analyze(text);

      assert.equal(result.summary.status, "CAUTION", `${count} kısıtlı madde CAUTION olmalı`);
      assert.equal(result.flags.restricted.length, count);
      assert.equal(result.summary.breakdown.restrictedPenalty, count * 15);
    }
  });

  test("Üçüncü kısıtlı madde eşiği aşıp durumu HAZARDOUS'a çevirmeli", async () => {
    const { service, text } = restrictedFormula(3);
    const result = await service.analyze(text);

    assert.equal(result.flags.restricted.length, 3);
    assert.equal(result.summary.status, "HAZARDOUS");
    assert.ok(result.summary.score >= 50, `eşik puandan değil madde sayısından gelmeli, gelen puan: ${result.summary.score}`);
  });

  test("Kısıtlı madde sayısı arttıkça puan düşmeli ve asla negatife inmemeli", async () => {
    const scores = [];
    for (const count of [0, 1, 2, 3, 4, 6, 10]) {
      const { service, text } = restrictedFormula(count);
      const result = await service.analyze(text);
      scores.push(result.summary.score);

      assert.ok(result.summary.score >= 0, "puan negatif olmamalı");
      assert.ok(result.summary.score <= 100, "puan 100'ü aşmamalı");
    }

    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] <= scores[i - 1], `puan monoton azalmalı, dizi: ${scores.join(" > ")}`);
    }
  });
});
