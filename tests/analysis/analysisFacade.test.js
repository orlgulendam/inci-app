// tests/analysis/analysisFacade.test.js - Modülün Dışa Açık Kapısı (Facade) ve Fabrika Testleri
// Odak: AnalysisFacade hiçbir testte doğrudan kapsanmıyordu; yalnızca catalog testinde
// sahte nesne olarak geçiyordu. Oysa CLAUDE.md'ye göre modüller arası iletişimin tek
// resmi yolu bu cephedir ve catalog modülü ürün kaydederken onu çağırır.
//
// Kapsam: public yüzeyin sözleşmesi, initializeAnalysisModule'ün bağımlılık enjeksiyonu
// dallanması, cephenin iş birlikçilerine doğru devretmesi ve hataları yutmaması.
// Gerçek MongoDB veya ağ kullanılmaz.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const initializeAnalysisModule = require("../../src/modules/analysis");
const analysisPublic = require("../../src/modules/analysis/public");
const AnalysisFacade = require("../../src/modules/analysis/public/AnalysisFacade");
const Ingredient = require("../../src/modules/analysis/domain/entities/Ingredient");
const MongoIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/MongoIngredientRepository");

const { normalizeKey } = MongoIngredientRepository;

// Çağrıları kaydeden, ağsız/veritabansız sahte repository.
function createSpyRepository(entries = []) {
  const byKey = new Map();
  for (const ingredient of entries) {
    byKey.set(normalizeKey(ingredient.inciName), ingredient);
  }

  const calls = [];
  return {
    calls,
    findByInciName: async (name) => {
      calls.push(["findByInciName", name]);
      return byKey.get(normalizeKey(name)) || null;
    },
    search: async (query, limit) => {
      calls.push(["search", query, limit]);
      return [...byKey.values()];
    },
    bulkFindByInciNames: async (names) => {
      calls.push(["bulkFindByInciNames", names]);
      const found = new Map();
      for (const name of names) {
        const hit = byKey.get(normalizeKey(name));
        if (hit) found.set(name, hit);
      }
      return found;
    }
  };
}

describe("Analysis Public Yüzeyi: Modül Sınırı Sözleşmesi", () => {
  test("public/index.js yalnızca AnalysisFacade'i dışa açmalı", () => {
    // Dış modüller YALNIZCA bu dosyadan import yapabilir; yüzey genişlerse
    // modül izolasyonu sessizce delinir.
    assert.deepEqual(Object.keys(analysisPublic), ["AnalysisFacade"]);
    assert.equal(analysisPublic.AnalysisFacade, AnalysisFacade);
  });

  test("Cephe beklenen üç genel metodu sunmalı", () => {
    const facade = new AnalysisFacade({}, {});

    for (const method of ["analyzeText", "getIngredient", "bulkGetIngredients"]) {
      assert.equal(typeof facade[method], "function", `${method} metodu bulunmalı`);
    }
  });
});

describe("Modül Fabrikası: Bağımlılık Enjeksiyonu", () => {
  test("Doğrudan repository nesnesi enjekte edilebilmeli", () => {
    const repository = createSpyRepository();

    const module = initializeAnalysisModule(repository);

    assert.equal(module.repository, repository, "ördek tipli repository doğrudan kullanılmalı");
  });

  test("Yalnızca search metodu olan nesne de repository sayılmalı", () => {
    const repository = { search: async () => [] };

    assert.equal(initializeAnalysisModule(repository).repository, repository);
  });

  test("options nesnesiyle repository ve ocrService ayrı ayrı enjekte edilmeli", () => {
    const repository = createSpyRepository();
    const ocrService = { extractIngredientsFromImage: async () => ({ ingredientsText: "" }) };

    const module = initializeAnalysisModule({ repository, ocrService });

    assert.equal(module.repository, repository);
    assert.equal(module.controller.ocrService, ocrService);
  });

  test("Enjeksiyon verilmediğinde somut Mongo repository'ye düşmeli", () => {
    // Üretim yolu: argüman yoksa veya tanınmayan bir nesne verilirse DIP varsayılanı.
    assert.equal(initializeAnalysisModule({}).repository.constructor.name, "MongoIngredientRepository");
    assert.equal(initializeAnalysisModule(null).repository.constructor.name, "MongoIngredientRepository");
  });

  test("Fabrika beş bileşeni de kurup döndürmeli", () => {
    const module = initializeAnalysisModule(createSpyRepository());

    assert.deepEqual(Object.keys(module), ["repository", "service", "controller", "router", "facade"]);
    assert.ok(module.facade instanceof AnalysisFacade);
    assert.equal(typeof module.router, "function", "Express router döndürülmeli");
  });

  test("Cephe fabrikanın kurduğu servis ve repository ile bağlanmalı", async () => {
    const repository = createSpyRepository([new Ingredient({ inciName: "AQUA" })]);
    const module = initializeAnalysisModule(repository);

    await module.facade.getIngredient("Aqua");

    assert.deepEqual(repository.calls, [["findByInciName", "Aqua"]], "cephe enjekte edilen repository'yi kullanmalı");
  });
});

describe("AnalysisFacade: analyzeText", () => {
  test("Metni analiz servisine olduğu gibi devretmeli", async () => {
    const seen = [];
    const service = {
      analyze: async (text) => {
        seen.push(text);
        return { summary: { score: 77 } };
      }
    };

    const result = await new AnalysisFacade(service, createSpyRepository()).analyzeText("Aqua, Glycerin");

    assert.deepEqual(seen, ["Aqua, Glycerin"]);
    assert.deepEqual(result, { summary: { score: 77 } });
  });

  test("Gerçek servis üzerinden tam analiz özeti dönmeli", async () => {
    const repository = createSpyRepository([
      new Ingredient({ inciName: "AQUA" }),
      new Ingredient({ inciName: "GLYCERIN" }),
      new Ingredient({ inciName: "LINALOOL", flags: { allergen: true } })
    ]);
    const { facade } = initializeAnalysisModule(repository);

    const result = await facade.analyzeText("Aqua, Glycerin, Linalool");

    assert.equal(result.summary.totalIngredients, 3);
    assert.equal(result.summary.matchedIngredients, 3);
    assert.equal(result.flags.allergens.length, 1);
    assert.ok(Array.isArray(result.items));
    assert.ok(result.conflicts, "çakışma raporu da cepheden dönmeli");
  });

  test("Cephe girdi doğrulaması yapmaz; boş metin analiz özetine düşmeli", async () => {
    // AnalysisController en az 3 karakter şartı koyar, cephe koymaz. catalog modülü
    // ürün kaydederken bu yoldan geçtiği için davranışın belgelenmesi gerekir.
    const { facade } = initializeAnalysisModule(createSpyRepository());

    const result = await facade.analyzeText("");

    assert.equal(result.summary.totalIngredients, 0);
    assert.equal(result.summary.isClean, false, "veri yokken temiz sayılmamalı");
  });

  test("Servis hatası cephede yutulmamalı", async () => {
    const service = {
      analyze: async () => {
        throw new Error("analiz servisi erişilemez");
      }
    };

    await assert.rejects(
      () => new AnalysisFacade(service, createSpyRepository()).analyzeText("Aqua"),
      /erişilemez/
    );
  });
});

describe("AnalysisFacade: getIngredient", () => {
  test("Tek kimyasalı repository'den getirmeli", async () => {
    const repository = createSpyRepository([new Ingredient({ inciName: "NIACINAMIDE", casNumber: "98-92-0" })]);
    const { facade } = initializeAnalysisModule(repository);

    const ingredient = await facade.getIngredient("Niacinamide");

    assert.equal(ingredient.inciName, "NIACINAMIDE");
    assert.equal(ingredient.casNumber, "98-92-0");
  });

  test("Sözlükte olmayan kimyasalda null dönmeli, hata fırlatmamalı", async () => {
    const { facade } = initializeAnalysisModule(createSpyRepository());

    assert.equal(await facade.getIngredient("Zzztol"), null);
  });

  test("Repository hatası çağırana iletilmeli", async () => {
    const repository = {
      findByInciName: async () => {
        throw new Error("veritabanı erişilemez");
      }
    };

    await assert.rejects(() => new AnalysisFacade({}, repository).getIngredient("Aqua"), /erişilemez/);
  });
});

describe("AnalysisFacade: bulkGetIngredients", () => {
  test("Toplu sorgu sonucunu Map olarak döndürmeli", async () => {
    const repository = createSpyRepository([
      new Ingredient({ inciName: "AQUA" }),
      new Ingredient({ inciName: "GLYCERIN" })
    ]);
    const { facade } = initializeAnalysisModule(repository);

    const found = await facade.bulkGetIngredients(["Aqua", "Glycerin", "Zzztol"]);

    assert.ok(found instanceof Map, "sonuç Map olmalı");
    assert.equal(found.size, 2, "yalnızca bulunanlar dönmeli");
    assert.equal(found.get("Aqua").inciName, "AQUA");
    assert.equal(found.has("Zzztol"), false);
  });

  test("Ad listesi repository'ye tek çağrıda geçmeli", async () => {
    const repository = createSpyRepository([new Ingredient({ inciName: "AQUA" })]);
    const { facade } = initializeAnalysisModule(repository);

    await facade.bulkGetIngredients(["Aqua", "Glycerin"]);

    assert.deepEqual(
      repository.calls,
      [["bulkFindByInciNames", ["Aqua", "Glycerin"]]],
      "cephe madde başına ayrı sorgu atmamalı"
    );
  });

  test("Boş ad listesinde boş Map dönmeli", async () => {
    const { facade } = initializeAnalysisModule(createSpyRepository());

    const found = await facade.bulkGetIngredients([]);

    assert.ok(found instanceof Map);
    assert.equal(found.size, 0);
  });

  test("Toplu sorguda farklı yazımlar kanonik kayda ulaşmalı", async () => {
    const repository = createSpyRepository([new Ingredient({ inciName: "SODIUM HYALURONATE" })]);
    const { facade } = initializeAnalysisModule(repository);

    const found = await facade.bulkGetIngredients(["sodium-hyaluronate", "SODIUM HYALURONATE"]);

    assert.equal(found.size, 2, "her iki yazım da eşleşmeli");
    for (const ingredient of found.values()) {
      assert.equal(ingredient.inciName, "SODIUM HYALURONATE");
    }
  });
});
