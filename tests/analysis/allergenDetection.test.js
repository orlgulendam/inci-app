// tests/analysis/allergenDetection.test.js - Alerjen ve Bileşen Grubu Tespiti Testleri
// Odak: Analysis modülünde alerjen tespiti sözlük bayrağı (flags.allergen) üzerinden yürür.
// Bu dosya grup bazlı davranışı doğrular: paraben, sülfat ve parfüm/koku alerjeni
// ailelerinin her üyesi, yazım biçiminden bağımsız olarak doğru bayrak kovasına düşmeli.
// Sözlük sahtelenir; gerçek MongoDB veya ağ çağrısı yapılmaz.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const AnalysisService = require("../../src/modules/analysis/application/services/AnalysisService");
const Ingredient = require("../../src/modules/analysis/domain/entities/Ingredient");
const MongoIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/MongoIngredientRepository");

const { normalizeKey } = MongoIngredientRepository;

// AB Kozmetik Yönetmeliği Ek III kapsamında zorunlu etiketlenen koku alerjenlerinden bir kesit.
const FRAGRANCE_ALLERGENS = [
  "LINALOOL",
  "LIMONENE",
  "GERANIOL",
  "CITRONELLOL",
  "CITRAL",
  "EUGENOL",
  "COUMARIN",
  "BENZYL ALCOHOL",
  "BENZYL SALICYLATE",
  "HYDROXYCITRONELLAL",
  "CINNAMYL ALCOHOL",
  "ISOEUGENOL"
];

// Ek V koruyucu listesinde yer alan, konsantrasyon kısıtlı paraben ailesi.
const PARABENS = ["METHYLPARABEN", "ETHYLPARABEN", "PROPYLPARABEN", "BUTYLPARABEN", "ISOBUTYLPARABEN"];

// Alerjen değil ancak sürfaktan/tahriş grubu olarak izlenen sülfatlar.
const SULFATES = ["SODIUM LAURYL SULFATE", "SODIUM LAURETH SULFATE", "AMMONIUM LAURYL SULFATE", "TEA-LAURYL SULFATE"];

function buildDictionary() {
  const entries = [
    new Ingredient({ inciName: "AQUA" }),
    new Ingredient({ inciName: "GLYCERIN" }),
    new Ingredient({ inciName: "PARFUM", flags: { allergen: true } }),
    new Ingredient({ inciName: "FRAGRANCE", flags: { allergen: true } }),
    new Ingredient({ inciName: "AROMA", flags: { allergen: true } })
  ];

  for (const name of FRAGRANCE_ALLERGENS) {
    entries.push(new Ingredient({ inciName: name, flags: { allergen: true }, euAnnex: { annex3: `Ref ${name}` } }));
  }
  for (const name of PARABENS) {
    entries.push(new Ingredient({
      inciName: name,
      flags: { restricted: true },
      euAnnex: { annex3: `Annex III ${name}`, preservative: `Annex V ${name}` }
    }));
  }
  for (const name of SULFATES) {
    entries.push(new Ingredient({ inciName: name }));
  }

  return entries;
}

function createService() {
  const byKey = new Map();
  for (const ingredient of buildDictionary()) {
    byKey.set(normalizeKey(ingredient.inciName), ingredient);
  }
  return new AnalysisService({
    findByInciName: async (name) => byKey.get(normalizeKey(name)) || null
  });
}

describe("Alerjen Tespiti: Koku Alerjeni Grubu", () => {
  test("Koku alerjeni ailesinin her üyesi alerjen kovasına düşmeli", async () => {
    const result = await createService().analyze(["Aqua", ...FRAGRANCE_ALLERGENS].join(", "));

    const flagged = result.flags.allergens.map((a) => a.inciName);

    assert.deepEqual(flagged, FRAGRANCE_ALLERGENS, "12 koku alerjeninin tamamı sırasıyla işaretlenmeli");
    assert.equal(result.flags.banned.length, 0, "hiçbiri yasaklı kovasına düşmemeli");
  });

  test("Alerjen bayrağı olmayan bileşen alerjen sayılmamalı", async () => {
    const result = await createService().analyze("Aqua, Glycerin");

    assert.equal(result.flags.allergens.length, 0);
    assert.equal(result.summary.status, "CLEAN");
  });

  test("Alerjen kaydı Ek III referansını ve mevzuat mesajını taşımalı", async () => {
    const result = await createService().analyze("Aqua, Linalool");

    const [allergen] = result.flags.allergens;
    assert.equal(allergen.inciName, "LINALOOL");
    assert.equal(allergen.reference, "Ref LINALOOL");
    assert.match(allergen.message, /26 koku alerjeninden biridir/);
  });

  test("Tek alerjen bile ürünü CLEAN durumundan çıkarmalı", async () => {
    const result = await createService().analyze("Aqua, Glycerin, Limonene");

    assert.equal(result.summary.status, "CAUTION");
    assert.equal(result.summary.isClean, false);
    assert.ok(result.summary.score < 100, `puan 100'ün altına inmeli, gelen: ${result.summary.score}`);
  });
});

describe("Alerjen Tespiti: Parfüm / Koku Eş Adları", () => {
  test("Parfum, Fragrance ve Aroma yazımları alerjen olarak işaretlenmeli", async () => {
    for (const spelling of ["Parfum", "Fragrance", "Aroma"]) {
      const result = await createService().analyze(`Aqua, ${spelling}`);

      assert.equal(result.flags.allergens.length, 1, `${spelling} alerjen olarak işaretlenmeli`);
      assert.equal(result.summary.unknownIngredients, 0, `${spelling} tanınmalı`);
    }
  });

  test("Parantezli 'Parfum (Fragrance)' ve 'Fragrance (Parfum)' aynı şekilde alerjen olmalı", async () => {
    for (const spelling of ["Parfum (Fragrance)", "Fragrance (Parfum)"]) {
      const result = await createService().analyze(`Aqua, ${spelling}`);

      assert.equal(result.flags.allergens.length, 1, `${spelling} alerjen olarak işaretlenmeli`);
    }
  });

  test("Parantezli parfüm kaydında kullanıcıya gösterilen ham metin korunmalı", async () => {
    const result = await createService().analyze("Aqua, Parfum (Fragrance)");

    const [allergen] = result.flags.allergens;
    assert.equal(allergen.inciName, "PARFUM", "kanonik INCI adı normalize edilmeli");
    assert.equal(allergen.raw, "Parfum (Fragrance)", "etiketteki ham yazım korunmalı");
  });

  test("Parfüm ve tek tek listelenen koku alerjenleri birlikte sayılmalı", async () => {
    const result = await createService().analyze("Aqua, Parfum, Linalool, Limonene, Geraniol");

    assert.equal(result.flags.allergens.length, 4);
    assert.deepEqual(
      result.flags.allergens.map((a) => a.inciName),
      ["PARFUM", "LINALOOL", "LIMONENE", "GERANIOL"]
    );
  });
});

describe("Alerjen Tespiti: Paraben Grubu", () => {
  test("Paraben ailesinin her üyesi kısıtlı ve koruyucu olarak işaretlenmeli", async () => {
    const result = await createService().analyze(["Aqua", ...PARABENS].join(", "));

    assert.deepEqual(result.flags.restricted.map((r) => r.inciName), PARABENS);
    assert.deepEqual(result.flags.preservatives.map((p) => p.inciName), PARABENS);
    assert.equal(result.flags.allergens.length, 0, "parabenler koku alerjeni kovasına düşmemeli");
  });

  test("Paraben yüklü formül HAZARDOUS olmalı (ikiden fazla kısıtlı madde)", async () => {
    const result = await createService().analyze(["Aqua", ...PARABENS].join(", "));

    assert.equal(result.summary.status, "HAZARDOUS");
    assert.equal(result.summary.isClean, false);
  });

  test("Tek paraben CAUTION seviyesinde kalmalı", async () => {
    const result = await createService().analyze("Aqua, Glycerin, Methylparaben");

    assert.equal(result.flags.restricted.length, 1);
    assert.equal(result.summary.status, "CAUTION");
  });

  test("Paraben kaydı hem Ek III hem Ek V referansını taşımalı", async () => {
    const result = await createService().analyze("Aqua, Propylparaben");

    assert.equal(result.flags.restricted[0].reference, "Annex III PROPYLPARABEN");
    assert.equal(result.flags.preservatives[0].reference, "Annex V PROPYLPARABEN");
  });
});

describe("Alerjen Tespiti: Sülfat Grubu", () => {
  test("Sülfat ailesinin her üyesi tanınmalı ancak alerjen sayılmamalı", async () => {
    const result = await createService().analyze(["Aqua", ...SULFATES].join(", "));

    assert.equal(result.summary.unknownIngredients, 0, "sülfatların tamamı sözlükte bulunmalı");
    assert.equal(result.flags.allergens.length, 0, "sülfatlar koku alerjeni değildir");
    assert.equal(result.flags.restricted.length, 0);
  });

  test("Bayraksız sülfatlar ürünü CLEAN bırakmalı", async () => {
    const result = await createService().analyze("Aqua, Sodium Laureth Sulfate, Glycerin");

    assert.equal(result.summary.status, "CLEAN");
    assert.equal(result.summary.isClean, true);
  });

  test("Tire içeren sülfat yazımı (TEA-Lauryl Sulfate) normalize edilip eşleşmeli", async () => {
    const result = await createService().analyze("Aqua, TEA-Lauryl Sulfate");

    assert.equal(result.summary.matchedIngredients, 2);
    assert.equal(result.items[1].inciName, "TEA-LAURYL SULFATE");
  });
});

describe("Alerjen Tespiti: Gruplar Bir Arada", () => {
  test("Paraben, sülfat ve koku alerjeni aynı formülde doğru kovalara bölünmeli", async () => {
    const result = await createService().analyze(
      "Aqua, Glycerin, Sodium Lauryl Sulfate, Methylparaben, Butylparaben, Parfum, Linalool, Limonene"
    );

    assert.deepEqual(
      result.flags.restricted.map((r) => r.inciName),
      ["METHYLPARABEN", "BUTYLPARABEN"]
    );
    assert.deepEqual(
      result.flags.allergens.map((a) => a.inciName),
      ["PARFUM", "LINALOOL", "LIMONENE"]
    );
    assert.deepEqual(
      result.flags.preservatives.map((p) => p.inciName),
      ["METHYLPARABEN", "BUTYLPARABEN"]
    );
    assert.equal(result.flags.banned.length, 0);
    assert.equal(result.summary.totalIngredients, 8);
    assert.equal(result.summary.unknownIngredients, 0);
  });

  test("Aynı bileşen iki kez listelenirse iki kez bayraklanmalı", async () => {
    const result = await createService().analyze("Aqua, Linalool, Glycerin, Linalool");

    assert.equal(result.flags.allergens.length, 2, "tekrarlanan alerjen ayrı ayrı sayılır");
    assert.equal(result.summary.totalIngredients, 4);
  });
});
