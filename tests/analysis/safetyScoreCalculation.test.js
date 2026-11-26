// tests/analysis/safetyScoreCalculation.test.js - Güvenlik Skoru Hesaplama Testleri
// Odak: SafetyScore değer nesnesinin belirlenimciliği (aynı girdi -> aynı skor), skorun
// beklenen aralıkta kalması, ceza/eşik sınırları, değişmezliği (immutability) ve
// AnalysisService üzerinden uçtan uca tutarlılığı.
//
// NOT: Boş bileşen listesinin 100/CLEAN üretmesi ve tamamı tanınmayan formülün 80/CLEAN
// alması tartışmalı bulgulardır; bu dosya o değerleri doğru kabul edip sabitlemez,
// yalnızca yapısal değişmezleri doğrular. Bulgular PR açıklamasında raporlanmıştır.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const SafetyScore = require("../../src/modules/analysis/domain/value-objects/SafetyScore");
const AnalysisService = require("../../src/modules/analysis/application/services/AnalysisService");
const Ingredient = require("../../src/modules/analysis/domain/entities/Ingredient");
const MongoIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/MongoIngredientRepository");

const { normalizeKey } = MongoIngredientRepository;

const ZERO_COUNTS = {
  total: 0,
  matched: 0,
  bannedCount: 0,
  restrictedCount: 0,
  allergenCount: 0,
  unknownCount: 0
};

const score = (overrides = {}) => SafetyScore.calculate({ ...ZERO_COUNTS, ...overrides });

function serviceWith(ingredients) {
  const byKey = new Map();
  for (const ingredient of ingredients) {
    byKey.set(normalizeKey(ingredient.inciName), ingredient);
  }
  return new AnalysisService({
    findByInciName: async (name) => byKey.get(normalizeKey(name)) || null
  });
}

describe("Güvenlik Skoru: Belirlenimcilik", () => {
  test("Aynı sayımlar her çağrıda birebir aynı skoru vermeli", () => {
    const counts = { total: 12, matched: 9, restrictedCount: 2, allergenCount: 3, unknownCount: 3 };

    const first = score(counts);
    const second = score(counts);

    assert.equal(first.score, second.score);
    assert.equal(first.status, second.status);
    assert.equal(first.isClean, second.isClean);
    assert.deepEqual(first.breakdown, second.breakdown);
  });

  test("Elli tekrarlı hesaplama tek bir sonuç üretmeli", () => {
    const counts = { total: 20, matched: 18, restrictedCount: 1, allergenCount: 2, unknownCount: 2 };

    const distinct = new Set(
      Array.from({ length: 50 }, () => JSON.stringify({ ...score(counts) }))
    );

    assert.equal(distinct.size, 1, "skor hesabı yan etkisiz ve belirlenimci olmalı");
  });

  test("Aynı metin iki kez analiz edildiğinde özdeş sonuç dönmeli", async () => {
    const ingredients = [
      new Ingredient({ inciName: "AQUA" }),
      new Ingredient({ inciName: "LINALOOL", flags: { allergen: true } }),
      new Ingredient({ inciName: "HYDROQUINONE", flags: { restricted: true } })
    ];
    const text = "Aqua, Linalool, Hydroquinone, Mystery Compound";

    const first = await serviceWith(ingredients).analyze(text);
    const second = await serviceWith(ingredients).analyze(text);

    assert.deepEqual(first, second, "aynı girdi aynı analiz sonucunu vermeli");
  });

  test("Bileşen sırası değişse de skor aynı kalmalı", async () => {
    const ingredients = [
      new Ingredient({ inciName: "AQUA" }),
      new Ingredient({ inciName: "LINALOOL", flags: { allergen: true } }),
      new Ingredient({ inciName: "HYDROQUINONE", flags: { restricted: true } })
    ];

    const ordered = await serviceWith(ingredients).analyze("Aqua, Linalool, Hydroquinone");
    const shuffled = await serviceWith(ingredients).analyze("Hydroquinone, Aqua, Linalool");

    assert.equal(ordered.summary.score, shuffled.summary.score);
    assert.equal(ordered.summary.status, shuffled.summary.status);
  });
});

describe("Güvenlik Skoru: Değer Aralığı", () => {
  test("Aşırı ceza yüklemesinde bile skor 0-100 aralığında kalmalı", () => {
    const extreme = score({ total: 400, restrictedCount: 200, allergenCount: 200, unknownCount: 400 });

    assert.ok(extreme.score >= 0, "skor negatif olamaz");
    assert.ok(extreme.score <= 100, "skor 100'ü aşamaz");
    assert.equal(extreme.status, "HAZARDOUS");
  });

  test("Yasaklı madde dışındaki cezalar skoru 10'un altına indirmemeli", () => {
    const heavy = score({ total: 50, restrictedCount: 40, allergenCount: 40, unknownCount: 50 });

    assert.equal(heavy.score, 10, "yasaklı madde yoksa taban puan 10 olmalı");
  });

  test("Yalnızca yasaklı madde skoru 0'a indirebilmeli", () => {
    assert.equal(score({ total: 1, bannedCount: 1 }).score, 0);
    assert.equal(score({ total: 10, bannedCount: 5, restrictedCount: 5 }).score, 0);
  });

  test("Kurucu metot aralık dışı ve ondalıklı skorları düzeltmeli", () => {
    const base = { status: "CLEAN", isClean: true, breakdown: {} };

    assert.equal(new SafetyScore({ ...base, score: 150 }).score, 100);
    assert.equal(new SafetyScore({ ...base, score: -50 }).score, 0);
    assert.equal(new SafetyScore({ ...base, score: 79.5 }).score, 80, "skor tam sayıya yuvarlanmalı");
    assert.equal(new SafetyScore({ ...base, score: 79.4 }).score, 79);
  });

  test("Her ceza bileşimi için skor tam sayı olmalı", () => {
    for (let restricted = 0; restricted <= 4; restricted++) {
      for (let allergen = 0; allergen <= 4; allergen++) {
        const result = score({ total: 10, restrictedCount: restricted, allergenCount: allergen });

        assert.ok(Number.isInteger(result.score), `tam sayı beklenirdi: ${result.score}`);
      }
    }
  });
});

describe("Güvenlik Skoru: Ceza ve Eşik Sınırları", () => {
  test("Kısıtlı madde başına 15, alerjen başına 6 puan düşmeli", () => {
    assert.equal(score({ total: 10, restrictedCount: 1 }).score, 85);
    assert.equal(score({ total: 10, restrictedCount: 2 }).score, 70);
    assert.equal(score({ total: 10, allergenCount: 1 }).score, 94);
    assert.equal(score({ total: 10, allergenCount: 2 }).score, 88);
  });

  test("Tanınmayan madde cezası 20 puanda tavan yapmalı", () => {
    assert.equal(score({ total: 10, unknownCount: 1 }).breakdown.unknownPenalty, 2);
    assert.equal(score({ total: 10, unknownCount: 10 }).breakdown.unknownPenalty, 20);
    assert.equal(score({ total: 100, unknownCount: 100 }).breakdown.unknownPenalty, 20, "tavan aşılmamalı");
  });

  test("Hiç ceza yoksa durum CLEAN ve isClean true olmalı", () => {
    const clean = score({ total: 10, matched: 10 });

    assert.equal(clean.score, 100);
    assert.equal(clean.status, "CLEAN");
    assert.equal(clean.isClean, true);
  });

  test("Tek alerjen bile CLEAN durumunu bozmalı", () => {
    const result = score({ total: 10, allergenCount: 1 });

    assert.equal(result.status, "CAUTION");
    assert.equal(result.isClean, false);
  });

  test("50 puan eşiğinin iki yanında durum CAUTION/HAZARDOUS olarak değişmeli", () => {
    const above = score({ total: 20, allergenCount: 8 });
    const below = score({ total: 20, allergenCount: 9 });

    assert.equal(above.score, 52);
    assert.equal(above.status, "CAUTION");
    assert.equal(below.score, 46);
    assert.equal(below.status, "HAZARDOUS");
  });

  test("Puan 50'nin üstünde olsa da üçten fazla kısıtlı madde HAZARDOUS yapmalı", () => {
    const result = score({ total: 20, restrictedCount: 3 });

    assert.equal(result.score, 55);
    assert.equal(result.status, "HAZARDOUS", "eşik madde sayısından tetiklenmeli");
  });

  test("Yasaklı madde ceza dökümünü sıfırlayıp bannedPenalty eklemeli", () => {
    const banned = score({ total: 10, bannedCount: 1, restrictedCount: 3, allergenCount: 3, unknownCount: 3 });

    assert.deepEqual(banned.breakdown, {
      bannedPenalty: 100,
      restrictedPenalty: 0,
      allergenPenalty: 0,
      unknownPenalty: 0
    });
  });

  test("Yasaklı madde yoksa dökümde bannedPenalty alanı bulunmamalı", () => {
    assert.deepEqual(score({ total: 10, restrictedCount: 1 }).breakdown, {
      restrictedPenalty: 15,
      allergenPenalty: 0,
      unknownPenalty: 0
    });
  });
});

describe("Güvenlik Skoru: Değişmezlik (Immutability)", () => {
  test("Skor nesnesi ve ceza dökümü dondurulmuş olmalı", () => {
    const result = score({ total: 10, restrictedCount: 1 });

    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.breakdown), true);
  });

  test("Skor alanına yapılan atama sessizce yok sayılmalı", () => {
    const result = score({ total: 10, restrictedCount: 1 });
    const original = result.score;

    result.score = 5;
    result.breakdown.restrictedPenalty = 999;

    assert.equal(result.score, original, "skor dışarıdan değiştirilememeli");
    assert.equal(result.breakdown.restrictedPenalty, 15, "ceza dökümü dışarıdan değiştirilememeli");
  });

  test("Döküm nesnesi kurucuya verilen referanstan kopyalanmalı", () => {
    const breakdown = { restrictedPenalty: 15, allergenPenalty: 0, unknownPenalty: 0 };
    const result = new SafetyScore({ score: 85, status: "CAUTION", isClean: false, breakdown });

    breakdown.restrictedPenalty = 999;

    assert.equal(result.breakdown.restrictedPenalty, 15, "dış mutasyon skoru etkilememeli");
  });
});

describe("Güvenlik Skoru: Boş ve Tanınmayan Listeler", () => {
  test("Boş bileşen listesi çökmeden tutarlı bir özet üretmeli", async () => {
    const result = await serviceWith([]).analyze("");

    assert.equal(result.summary.totalIngredients, 0);
    assert.equal(result.summary.matchedIngredients, 0);
    assert.equal(result.summary.unknownIngredients, 0);
    assert.ok(Number.isInteger(result.summary.score), "boş listede skor sayı olmalı");
    assert.ok(result.summary.score >= 0 && result.summary.score <= 100, "skor aralıkta kalmalı");
    assert.deepEqual(result.unknown, []);
    assert.deepEqual(result.items, []);
    for (const [bucket, entries] of Object.entries(result.flags)) {
      assert.deepEqual(entries, [], `${bucket} kovası boş olmalı`);
    }
  });

  test("null ve boşluk girdisi boş listeyle aynı özeti vermeli", async () => {
    const empty = await serviceWith([]).analyze("");
    const nullish = await serviceWith([]).analyze(null);
    const blank = await serviceWith([]).analyze("   \n  ");

    assert.deepEqual(nullish.summary, empty.summary);
    assert.deepEqual(blank.summary, empty.summary);
  });

  test("Tamamı tanınmayan formülde bileşenler sayılmalı ve tanınmayan listesi dolmalı", async () => {
    const text = Array.from({ length: 30 }, (_, i) => `Unknownium ${i + 1}`).join(", ");

    const result = await serviceWith([]).analyze(text);

    assert.equal(result.summary.totalIngredients, 30);
    assert.equal(result.summary.matchedIngredients, 0);
    assert.equal(result.summary.unknownIngredients, 30);
    assert.equal(result.unknown.length, 30);
    assert.equal(result.summary.breakdown.unknownPenalty, 20, "tanınmayan cezası tavanda olmalı");
    assert.ok(result.items.every((item) => item.matched === false && item.badges === null));
  });

  test("Kısmen tanınan formülde tanınan ve tanınmayan sayıları toplamı tutmalı", async () => {
    const result = await serviceWith([
      new Ingredient({ inciName: "AQUA" }),
      new Ingredient({ inciName: "GLYCERIN" })
    ]).analyze("Aqua, Glycerin, Mystery Compound, Another Unknown");

    assert.equal(result.summary.totalIngredients, 4);
    assert.equal(result.summary.matchedIngredients, 2);
    assert.equal(result.summary.unknownIngredients, 2);
    assert.equal(
      result.summary.matchedIngredients + result.summary.unknownIngredients,
      result.summary.totalIngredients
    );
  });
});
