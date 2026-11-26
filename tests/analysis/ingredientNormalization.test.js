// tests/analysis/ingredientNormalization.test.js - Bileşen Normalizasyonu ve Eş Ad Eşleştirme Testleri
// Odak: Aynı kimyasalın farklı yazımlarının (büyük/küçük harf, tire, alt çizgi, nokta, aksan,
// parantezli eş ad, CI kodu, slash'lı bileşik ad) aynı sonuca varması.
// Repository'nin normalizeKey sözleşmesi ile AnalysisService.resolveToken çözümleme zinciri
// birlikte doğrulanır. Gerçek MongoDB veya ağ kullanılmaz; repository sahtelenir.
//
// Dosyanın sonundaki "Düzeltilen Hatalar" bölümü, bu PR'da giderilen Türkçe
// normalizasyon hatasının regresyon testlerini içerir.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const MongoIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/MongoIngredientRepository");
const AnalysisService = require("../../src/modules/analysis/application/services/AnalysisService");
const Ingredient = require("../../src/modules/analysis/domain/entities/Ingredient");

const { normalizeKey } = MongoIngredientRepository;

// Gerçek repository'nin anahtar normalizasyonunu kullanan, ağsız/veritabansız sahte repository.
function createFakeRepository(entries) {
  const byKey = new Map();
  for (const ingredient of entries) {
    byKey.set(normalizeKey(ingredient.inciName), ingredient);
  }

  const lookups = [];
  return {
    lookups,
    findByInciName: async (name) => {
      lookups.push(name);
      return byKey.get(normalizeKey(name)) || null;
    }
  };
}

describe("Bileşen Normalizasyonu: normalizeKey Sözleşmesi", () => {
  test("Büyük/küçük harf farkı aynı anahtara inmeli", () => {
    assert.equal(normalizeKey("SODIUM HYALURONATE"), normalizeKey("sodium hyaluronate"));
    assert.equal(normalizeKey("Sodium Hyaluronate"), "sodium hyaluronate");
  });

  test("Fazla boşluk ve baştaki/sondaki boşluk tek anahtara indirgenmeli", () => {
    assert.equal(normalizeKey("  SODIUM   HYALURONATE  "), "sodium hyaluronate");
  });

  test("Tire, alt çizgi ve nokta ayraçları boşluğa normalize edilmeli", () => {
    assert.equal(normalizeKey("Sodium-Hyaluronate"), "sodium hyaluronate");
    assert.equal(normalizeKey("Sodium_Hyaluronate"), "sodium hyaluronate");
    assert.equal(normalizeKey("sodium.hyaluronate"), "sodium hyaluronate");
  });

  test("Aksanlı harfler aksansız karşılığına indirgenmeli", () => {
    assert.equal(normalizeKey("Tocophéryl Acetate"), normalizeKey("Tocopheryl Acetate"));
    assert.equal(normalizeKey("Aloë Vera"), normalizeKey("Aloe Vera"));
  });

  test("Aynı kimyasalın altı farklı yazımı tek anahtarda buluşmalı", () => {
    const variants = [
      "Tocopheryl Acetate",
      "tocopheryl acetate",
      "TOCOPHERYL   ACETATE",
      "Tocopheryl-Acetate",
      "Tocopheryl_Acetate",
      "Tocophéryl Acetate"
    ];

    const keys = new Set(variants.map(normalizeKey));

    assert.equal(keys.size, 1, `tüm yazımlar aynı anahtara inmeli, gelen: ${[...keys].join(" | ")}`);
  });

  test("Boş, null ve undefined girdiler boş anahtar vermeli ve çökmemeli", () => {
    assert.equal(normalizeKey(""), "");
    assert.equal(normalizeKey(null), "");
    assert.equal(normalizeKey(undefined), "");
  });

  test("Noktalama içeren CAS/CI yazımları harf-rakam bloklarına ayrılmalı", () => {
    assert.equal(normalizeKey("C.I. 77491"), "c i 77491");
    assert.equal(normalizeKey("1,2-Hexanediol"), "1 2 hexanediol");
  });
});

describe("Bileşen Normalizasyonu: Ingredient Entity", () => {
  test("Bileşen adı büyük harfe çevrilip kırpılmalı", () => {
    assert.equal(new Ingredient({ inciName: "  sodium hyaluronate " }).inciName, "SODIUM HYALURONATE");
  });

  test("Geçersiz bileşen adında entity oluşturulmamalı", () => {
    const expected = { message: "Ingredient entity requires a valid inciName" };

    assert.throws(() => new Ingredient({ inciName: "" }), expected);
    assert.throws(() => new Ingredient({ inciName: null }), expected);
    assert.throws(() => new Ingredient({ inciName: 123 }), expected);
    assert.throws(() => new Ingredient({}), expected);
  });

  test("UV filtre alanı hem snake_case hem camelCase şemadan okunmalı", () => {
    assert.equal(new Ingredient({ inciName: "X Compound", euAnnex: { uv_filter: "Ref 28" } }).euAnnex.uvFilter, "Ref 28");
    assert.equal(new Ingredient({ inciName: "X Compound", euAnnex: { uvFilter: "Ref 28" } }).euAnnex.uvFilter, "Ref 28");
  });

  test("Dizi olmayan fonksiyon alanı boş diziye düşmeli", () => {
    assert.deepEqual(new Ingredient({ inciName: "X Compound", functions: "solvent" }).functions, []);
    assert.deepEqual(new Ingredient({ inciName: "X Compound", functionsTr: null }).functionsTr, []);
  });

  test("Bayraklar kesin boolean değere zorlanmalı", () => {
    const ingredient = new Ingredient({
      inciName: "X Compound",
      flags: { banned: "yes", restricted: 0, allergen: 1 }
    });

    assert.deepEqual(ingredient.flags, { banned: true, restricted: false, allergen: true });
  });

  test("Boş Annex listesi ilgili rozeti tetiklememeli", () => {
    assert.equal(new Ingredient({ inciName: "X Compound", euAnnex: { preservative: [] } }).isPreservative(), false);
    assert.equal(new Ingredient({ inciName: "X Compound", euAnnex: { preservative: "Ref 12" } }).isPreservative(), true);
  });
});

describe("Eş Ad Eşleştirme: AnalysisService.resolveToken", () => {
  const repository = createFakeRepository([
    new Ingredient({ inciName: "AQUA" }),
    new Ingredient({ inciName: "GLYCERIN" }),
    new Ingredient({ inciName: "BUTYLENE GLYCOL" }),
    new Ingredient({ inciName: "TOCOPHERYL ACETATE" }),
    new Ingredient({ inciName: "CI 77491", euAnnex: { colorant: "Ref 77491" } })
  ]);
  const service = new AnalysisService(repository);

  test("Tam ad doğrudan eşleşmeli (exact)", async () => {
    const result = await service.resolveToken("Aqua");

    assert.equal(result.method, "exact");
    assert.equal(result.ingredient.inciName, "AQUA");
  });

  test("Yüzde ifadesi temizlendikten sonra tam ad eşleşmeli", async () => {
    const result = await service.resolveToken("AQUA (%7.5)");

    assert.equal(result.method, "exact");
    assert.equal(result.ingredient.inciName, "AQUA");
  });

  test("Parantez dışındaki ad eşleşmeli (outer_parens)", async () => {
    const result = await service.resolveToken("Aqua (Water)");

    assert.equal(result.method, "outer_parens");
    assert.equal(result.ingredient.inciName, "AQUA");
  });

  test("Parantez içindeki eş ad eşleşmeli (inner_parens)", async () => {
    const result = await service.resolveToken("Water (Aqua)");

    assert.equal(result.method, "inner_parens");
    assert.equal(result.ingredient.inciName, "AQUA");
  });

  test("CI renk kodu boşluklu ve boşluksuz yazımda aynı bileşene varmalı", async () => {
    const spaced = await service.resolveToken("Iron Oxides CI 77491");
    const tight = await service.resolveToken("CI77491");

    assert.equal(spaced.method, "ci_code");
    assert.equal(tight.method, "ci_code");
    assert.equal(spaced.ingredient.inciName, "CI 77491");
    assert.equal(tight.ingredient.inciName, "CI 77491");
  });

  test("Slash ile birleşik bileşen adında ilk tanınan parça eşleşmeli (slash_split)", async () => {
    const result = await service.resolveToken("Butylene Glycol/Glycerin");

    assert.equal(result.method, "slash_split");
    assert.equal(result.ingredient.inciName, "BUTYLENE GLYCOL");
  });

  test("Aksanlı yazım da sözlükteki aksansız bileşene eşleşmeli", async () => {
    const result = await service.resolveToken("Tocophéryl Acetate");

    assert.equal(result.ingredient.inciName, "TOCOPHERYL ACETATE");
  });

  test("Sözlükte olmayan bileşen 'unmatched' olarak işaretlenmeli, hata fırlatmamalı", async () => {
    const result = await service.resolveToken("Unknownium Extract");

    assert.equal(result.method, "unmatched");
    assert.equal(result.ingredient, null);
    assert.equal(result.clean, "Unknownium Extract");
  });

  test("İki karakterden kısa jeton tamamen yok sayılmalı", async () => {
    assert.equal(await service.resolveToken("A"), null);
    assert.equal(await service.resolveToken("*"), null);
    assert.equal(await service.resolveToken("  "), null);
  });
});

describe("Eş Ad Eşleştirme: Farklı Yazımlar Aynı Analiz Sonucunu Vermeli", () => {
  function buildService() {
    return new AnalysisService(createFakeRepository([
      new Ingredient({ inciName: "AQUA" }),
      new Ingredient({ inciName: "SODIUM HYALURONATE" }),
      new Ingredient({ inciName: "TOCOPHERYL ACETATE", flags: { allergen: true } })
    ]));
  }

  test("Dört farklı yazımla yazılmış aynı formül aynı özeti üretmeli", async () => {
    const variants = [
      "Aqua, Sodium Hyaluronate, Tocopheryl Acetate",
      "AQUA, SODIUM HYALURONATE, TOCOPHERYL ACETATE",
      "aqua, sodium-hyaluronate, tocopheryl_acetate",
      "Aqua,   Sodium   Hyaluronate,  Tocophéryl Acetate"
    ];

    const summaries = [];
    for (const text of variants) {
      const result = await buildService().analyze(text);
      summaries.push({
        total: result.summary.totalIngredients,
        matched: result.summary.matchedIngredients,
        unknown: result.summary.unknownIngredients,
        score: result.summary.score,
        status: result.summary.status,
        allergens: result.flags.allergens.map((a) => a.inciName)
      });
    }

    for (const summary of summaries) {
      assert.deepEqual(summary, summaries[0], "farklı yazımlar aynı analiz özetine varmalı");
    }
    assert.equal(summaries[0].matched, 3, "üç bileşenin tamamı tanınmalı");
    assert.equal(summaries[0].unknown, 0);
  });

  test("Tanınan bileşenin kanonik INCI adı yazım farkından bağımsız dönmeli", async () => {
    const result = await buildService().analyze("sodium-hyaluronate");

    assert.equal(result.items[0].inciName, "SODIUM HYALURONATE");
    assert.equal(result.items[0].matched, true);
  });

  test("Tanınmayan bileşenin adı büyük harfe çevrilip rozetsiz dönmeli", async () => {
    const result = await buildService().analyze("Aqua, Mystery Compound");

    const unmatched = result.items.find((item) => !item.matched);
    assert.equal(unmatched.inciName, "MYSTERY COMPOUND");
    assert.equal(unmatched.badges, null);
    assert.deepEqual(result.unknown, ["Mystery Compound"]);
  });
});

describe("Bileşen Normalizasyonu: Düzeltilen Hatalar (Regresyon)", () => {
  test("Türkçe noktasız 'ı' harfi düşürülmeyip 'i' olarak normalize edilmeli", () => {
    // NFD ayrıştırması "ı" (U+0131) harfini çözmediği için eskiden tamamen siliniyordu:
    // "Çay Ağacı" -> "cay agac". Böylece ASCII karşılığıyla eşleşmiyordu.
    assert.equal(normalizeKey("Çay Ağacı"), "cay agaci");
    assert.equal(normalizeKey("Çay Ağacı"), normalizeKey("Cay Agaci"));
  });

  test("Noktalı 'İ' ve noktasız 'ı' aynı ASCII harfe inmeli", () => {
    assert.equal(normalizeKey("İzopropil"), "izopropil");
    assert.equal(normalizeKey("Isıtıcı"), "isitici");
    assert.equal(normalizeKey("IŞILTI"), normalizeKey("isilti"));
  });

  test("Türkçe karakterli bileşen adı ASCII yazımıyla aynı anahtara inmeli", () => {
    const pairs = [
      ["Çay Ağacı Yağı", "Cay Agaci Yagi"],
      ["Üzüm Çekirdeği Yağı", "Uzum Cekirdegi Yagi"],
      ["Şeker Kamışı Özü", "Seker Kamisi Ozu"],
      ["Çörek Otu Yağı", "Corek Otu Yagi"]
    ];

    for (const [turkish, ascii] of pairs) {
      assert.equal(normalizeKey(turkish), normalizeKey(ascii), `${turkish} ≠ ${ascii}`);
    }
  });

  test("Türkçe adlı bileşen ASCII yazımıyla sözlükte bulunabilmeli", async () => {
    const repository = createFakeRepository([new Ingredient({ inciName: "CAY AGACI YAGI" })]);
    const service = new AnalysisService(repository);

    const turkish = await service.resolveToken("Çay Ağacı Yağı");

    assert.equal(turkish.method, "exact");
    assert.equal(turkish.ingredient.inciName, "CAY AGACI YAGI");
  });

  test("Diğer Türkçe harflerin normalizasyonu bozulmamalı", () => {
    assert.equal(normalizeKey("Ğ"), "g");
    assert.equal(normalizeKey("Şeker"), "seker");
    assert.equal(normalizeKey("Çay"), "cay");
    assert.equal(normalizeKey("Ürea"), "urea");
    assert.equal(normalizeKey("Öz"), "oz");
  });

  test("Metin olmayan girdi normalizasyonda çökmemeli", () => {
    assert.equal(normalizeKey(123), "123");
    assert.equal(normalizeKey(0), "");
    assert.equal(normalizeKey(false), "");
  });
});
