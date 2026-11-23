// tests/analysis/regulationFlags.test.js - Regülasyon İşaretleri (Annex II/III) Şema Uyumu Testleri
// Gerekçe: MongoDB `flags.is_banned`, yerel yedek sözlük `flags.banned` kullanıyor.
// Yalnızca biri okunduğunda tüm yasaklı/kısıtlı/alerjen maddeler sessizce işaretsiz kalıyor
// ve her ürün 100/CLEAN puan alıyordu. Bu test o sessiz bozulmayı yakalar.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const MongoIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/MongoIngredientRepository");
const AnalysisService = require("../../src/modules/analysis/application/services/AnalysisService");

describe("Regülasyon İşaretleri: Şema Uyumu ve Puanlama", () => {
  test("normalizeFlags MongoDB'nin is_* şemasını domain şemasına çevirmeli", () => {
    const flags = MongoIngredientRepository.normalizeFlags({
      is_banned: true,
      is_restricted: false,
      is_allergen: true
    });

    assert.equal(flags.banned, true);
    assert.equal(flags.restricted, false);
    assert.equal(flags.allergen, true);
  });

  test("normalizeFlags yerel yedek sözlüğün kısa şemasını da desteklemeli", () => {
    const flags = MongoIngredientRepository.normalizeFlags({
      banned: false,
      restricted: true,
      allergen: false
    });

    assert.equal(flags.banned, false);
    assert.equal(flags.restricted, true);
    assert.equal(flags.allergen, false);
  });

  test("normalizeFlags işaret bilgisi olmayan maddede tüm bayrakları false yapmalı", () => {
    assert.deepEqual(MongoIngredientRepository.normalizeFlags(), {
      banned: false,
      restricted: false,
      allergen: false
    });
  });

  test("toDomain is_* şemalı dokümanda isBanned() true döndürmeli", () => {
    const ingredient = MongoIngredientRepository.toDomain({
      _id: "x1",
      inci_name: "MERCURY",
      cas_number: "7439-97-6",
      flags: { is_banned: true, is_restricted: false, is_allergen: false }
    });

    assert.equal(ingredient.isBanned(), true);
    assert.equal(ingredient.isRestricted(), false);
  });

  test("Kısıtlı madde içeren ürün CLEAN/100 olarak puanlanmamalı", async () => {
    // Repository taklidi: gerçek MongoDB şemasını (is_*) aynen taklit eder.
    const docs = {
      aqua: { inci_name: "AQUA", flags: { is_banned: false, is_restricted: false, is_allergen: false } },
      hydroquinone: { inci_name: "HYDROQUINONE", flags: { is_banned: false, is_restricted: true, is_allergen: false } },
      linalool: { inci_name: "LINALOOL", flags: { is_banned: false, is_restricted: false, is_allergen: true } }
    };

    const fakeRepository = {
      findByInciName: async (name) => MongoIngredientRepository.toDomain(docs[MongoIngredientRepository.normalizeKey(name)])
    };

    const service = new AnalysisService(fakeRepository);
    const result = await service.analyze("Aqua, Hydroquinone, Linalool");

    assert.equal(result.summary.isClean, false, "kısıtlı + alerjen madde varken ürün 'temiz' sayılmamalı");
    assert.ok(result.summary.score < 100, `puan 100'ün altında olmalı, gelen: ${result.summary.score}`);
    assert.ok(result.flags.restricted.length > 0, "kısıtlı madde listesi boş kalmamalı");
    assert.ok(result.flags.allergens.length > 0, "alerjen listesi boş kalmamalı");
  });

  test("Yasaklı madde içeren ürün 0 puan ve HAZARDOUS olmalı", async () => {
    const fakeRepository = {
      findByInciName: async (name) => MongoIngredientRepository.toDomain({
        inci_name: String(name).toUpperCase(),
        flags: { is_banned: /mercury/i.test(name), is_restricted: false, is_allergen: false }
      })
    };

    const service = new AnalysisService(fakeRepository);
    const result = await service.analyze("Mercury, Aqua");

    assert.equal(result.summary.score, 0);
    assert.equal(result.summary.status, "HAZARDOUS");
    assert.ok(result.flags.banned.length > 0);
  });
});
