// tests/analysis/ingredientRepository.test.js - Somut Repository'nin Örnek Metotları
// Odak: MongoIngredientRepository'nin ensureCache / findByInciName / search /
// bulkFindByInciNames metotları hiçbir testte kapsanmıyordu; yalnızca statik
// yardımcıları (normalizeKey, normalizeFlags, toDomain) doğrulanıyordu.
//
// Yöntem: core/database/mongo modülü, repository yüklenmeden ÖNCE require.cache
// üzerinden sahtelenir; getDb() testin belirlediği sahte veritabanını döndürür ya da
// bağlantı yokmuş gibi hata fırlatır. node --test her dosyayı ayrı süreçte koşturduğu
// için bu sahteleme diğer test dosyalarına sızmaz. Gerçek MongoDB veya ağ kullanılmaz.
//
// Yerel JSON yedeği, gerçek 17 MB'lık data/glossary.flagged.json yerine geçici bir
// çalışma dizinine yazılan küçük bir fixture ile test edilir.
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// --- getDb sahtelemesi: repository require edilmeden önce yerleştirilmeli ---
const mongoModulePath = require.resolve("../../src/core/database/mongo");
let activeDb = null; // null ise bağlantı yokmuş gibi davranılır
require.cache[mongoModulePath] = {
  id: mongoModulePath,
  filename: mongoModulePath,
  loaded: true,
  exports: {
    getDb: () => {
      if (!activeDb) throw new Error("MongoDB bağlantısı kurulamadı");
      return activeDb;
    }
  }
};

const MongoIngredientRepository = require("../../src/modules/analysis/infrastructure/repositories/MongoIngredientRepository");

// Çağrılarını kaydeden sahte MongoDB koleksiyonu.
function createFakeDb({ docs = [], findOneResult = null, findOneThrows = false, findThrows = false } = {}) {
  const calls = [];
  return {
    calls,
    collection: (name) => ({
      find: (query, options) => {
        calls.push({ op: "find", collection: name, hasProjection: Boolean(options && options.projection) });
        if (findThrows) throw new Error("find başarısız");
        return {
          toArray: async () => docs,
          limit: (max) => {
            calls.push({ op: "limit", max });
            return { toArray: async () => docs };
          }
        };
      },
      findOne: async (query) => {
        calls.push({ op: "findOne", fields: (query.$or || []).map((clause) => Object.keys(clause)[0]) });
        if (findOneThrows) throw new Error("findOne başarısız");
        return findOneResult;
      }
    })
  };
}

const MONGO_DOCS = [
  { _id: "1", inci_name: "AQUA", cas_number: "7732-18-5", functions_tr: ["Çözücü"], flags: { is_banned: false } },
  { _id: "2", name: "GLYCERIN", cas: "56-81-5", flags: { is_restricted: true } },
  { _id: "3", flags: {} } // adı olmayan bozuk doküman
];

afterEach(() => {
  activeDb = null;
});

describe("Repository: ensureCache (MongoDB yolu)", () => {
  test("Önbellek MongoDB dokümanlarından doldurulmalı", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    assert.equal(repository.initialized, false, "başlangıçta önbellek hazır olmamalı");
    await repository.ensureCache();

    assert.equal(repository.initialized, true);
    assert.equal(repository.memoryCache.size, 2, "adı olmayan doküman atlanmalı");
    assert.deepEqual([...repository.memoryCache.keys()], ["aqua", "glycerin"]);
  });

  test("Önbellek sorgusu yalnızca gerekli alanları projeksiyonla istemeli", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    await repository.ensureCache();

    assert.deepEqual(activeDb.calls, [{ op: "find", collection: "ingredients", hasProjection: true }]);
  });

  test("İkinci çağrı veritabanına tekrar gitmemeli", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    await repository.ensureCache();
    await repository.ensureCache();
    await repository.ensureCache();

    assert.equal(activeDb.calls.length, 1, "önbellek bir kez ısıtılmalı");
  });

  test("Hem inci_name hem name şeması okunmalı", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    const fromInciName = await repository.findByInciName("Aqua");
    const fromName = await repository.findByInciName("Glycerin");

    assert.equal(fromInciName.inciName, "AQUA");
    assert.equal(fromInciName.casNumber, "7732-18-5");
    assert.equal(fromName.inciName, "GLYCERIN");
    assert.equal(fromName.casNumber, "56-81-5", "cas kısa alan adı da okunmalı");
  });

  test("is_* bayrak şeması domain nesnesine taşınmalı", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    const glycerin = await repository.findByInciName("Glycerin");

    assert.equal(glycerin.isRestricted(), true);
    assert.equal(glycerin.isBanned(), false);
  });
});

describe("Repository: findByInciName", () => {
  test("Önbellekten gelen kayıt için veritabanına gidilmemeli", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();
    await repository.ensureCache();
    const callsAfterPriming = activeDb.calls.length;

    await repository.findByInciName("Aqua");

    assert.equal(activeDb.calls.length, callsAfterPriming, "0ms önbellek yolu sorgu atmamalı");
  });

  test("Farklı yazımlar aynı önbellek kaydına ulaşmalı", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    for (const spelling of ["Aqua", "aqua", "  AQUA  ", "aqua"]) {
      const found = await repository.findByInciName(spelling);
      assert.equal(found.inciName, "AQUA", `${JSON.stringify(spelling)} eşleşmeli`);
    }
  });

  test("Önbellekte olmayan ad doğrudan veritabanından sorgulanmalı", async () => {
    activeDb = createFakeDb({
      docs: [],
      findOneResult: { _id: "9", inci_name: "NIACINAMIDE", flags: { is_allergen: true } }
    });
    const repository = new MongoIngredientRepository();

    const found = await repository.findByInciName("Niacinamide");

    assert.equal(found.inciName, "NIACINAMIDE");
    assert.equal(found.isAllergen(), true);
    const findOneCall = activeDb.calls.find((c) => c.op === "findOne");
    assert.deepEqual(findOneCall.fields, ["inci_name", "name"], "her iki ad alanı da aranmalı");
  });

  test("Veritabanından gelen kayıt önbelleğe yazılmalı", async () => {
    activeDb = createFakeDb({
      docs: [],
      findOneResult: { _id: "9", inci_name: "NIACINAMIDE", flags: {} }
    });
    const repository = new MongoIngredientRepository();

    await repository.findByInciName("Niacinamide");
    const callsAfterFirst = activeDb.calls.length;
    const second = await repository.findByInciName("Niacinamide");

    assert.equal(second.inciName, "NIACINAMIDE");
    assert.equal(activeDb.calls.length, callsAfterFirst, "ikinci çağrı önbellekten dönmeli");
  });

  test("Boş veya geçersiz ad sorgu atmadan null dönmeli", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    assert.equal(await repository.findByInciName(""), null);
    assert.equal(await repository.findByInciName(null), null);
    assert.equal(await repository.findByInciName(undefined), null);
    assert.deepEqual(activeDb.calls, [], "geçersiz ad için veritabanına gidilmemeli");
  });

  test("Sorgu hatası yutulup null dönmeli, istisna sızmamalı", async () => {
    activeDb = createFakeDb({ docs: [], findOneThrows: true });
    const repository = new MongoIngredientRepository();

    assert.equal(await repository.findByInciName("Zzztol"), null);
  });

  test("Sözlükte bulunmayan ad null dönmeli", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS, findOneResult: null });
    const repository = new MongoIngredientRepository();

    assert.equal(await repository.findByInciName("Zzztol"), null);
  });
});

describe("Repository: search", () => {
  test("İki karakterden kısa sorgu veritabanına hiç gitmemeli", async () => {
    activeDb = createFakeDb({ docs: [{ inci_name: "NIACINAMIDE" }] });
    const repository = new MongoIngredientRepository();

    assert.deepEqual(await repository.search("a"), []);
    assert.deepEqual(await repository.search(""), []);
    assert.deepEqual(await repository.search("  "), []);
    assert.deepEqual(await repository.search(null), []);
    assert.deepEqual(activeDb.calls, []);
  });

  test("Eşleşen dokümanlar domain nesnesine dönüştürülmeli", async () => {
    activeDb = createFakeDb({ docs: [{ inci_name: "NIACINAMIDE" }, { name: "NIACIN" }] });
    const repository = new MongoIngredientRepository();

    const results = await repository.search("niacin");

    assert.deepEqual(results.map((i) => i.inciName), ["NIACINAMIDE", "NIACIN"]);
    assert.equal(typeof results[0].isBanned, "function", "domain entity dönmeli");
  });

  test("Varsayılan limit 20 olmalı", async () => {
    activeDb = createFakeDb({ docs: [] });
    const repository = new MongoIngredientRepository();

    await repository.search("niacin");

    assert.deepEqual(activeDb.calls.filter((c) => c.op === "limit"), [{ op: "limit", max: 20 }]);
  });

  test("Limit 50'yi aşamamalı", async () => {
    activeDb = createFakeDb({ docs: [] });
    const repository = new MongoIngredientRepository();

    await repository.search("niacin", 500);
    await repository.search("niacin", 10);

    assert.deepEqual(
      activeDb.calls.filter((c) => c.op === "limit").map((c) => c.max),
      [50, 10],
      "aşırı limit kırpılmalı, küçük limit korunmalı"
    );
  });

  test("Arama hatası yutulup boş dizi dönmeli", async () => {
    activeDb = createFakeDb({ docs: [], findThrows: true });
    const repository = new MongoIngredientRepository();

    assert.deepEqual(await repository.search("niacin"), []);
  });
});

describe("Repository: bulkFindByInciNames", () => {
  test("Yalnızca bulunan kayıtlar Map olarak dönmeli", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS, findOneResult: null });
    const repository = new MongoIngredientRepository();

    const found = await repository.bulkFindByInciNames(["Aqua", "Glycerin", "Zzztol"]);

    assert.ok(found instanceof Map);
    assert.equal(found.size, 2);
    assert.equal(found.get("Aqua").inciName, "AQUA");
    assert.equal(found.has("Zzztol"), false);
  });

  test("Map anahtarı istemcinin gönderdiği yazımı korumalı", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS, findOneResult: null });
    const repository = new MongoIngredientRepository();

    const found = await repository.bulkFindByInciNames(["  aqua  "]);

    assert.deepEqual([...found.keys()], ["  aqua  "]);
    assert.equal(found.get("  aqua  ").inciName, "AQUA");
  });

  test("Tüm adlar önbellekteyse hiç sorgu atılmamalı", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();
    await repository.ensureCache();
    const callsAfterPriming = activeDb.calls.length;

    await repository.bulkFindByInciNames(["Aqua", "Glycerin", "aqua"]);

    assert.equal(activeDb.calls.length, callsAfterPriming, "önbellekten karşılanan toplu sorgu veritabanına gitmemeli");
  });

  test("Boş ad listesinde boş Map dönmeli", async () => {
    activeDb = createFakeDb({ docs: MONGO_DOCS });
    const repository = new MongoIngredientRepository();

    const found = await repository.bulkFindByInciNames([]);

    assert.ok(found instanceof Map);
    assert.equal(found.size, 0);
  });
});

describe("Repository: Yerel JSON Yedeği (veritabanı erişilemezken)", () => {
  const originalCwd = process.cwd();
  let tempDir = null;

  beforeEach(() => {
    activeDb = null; // getDb hata fırlatır: MongoDB erişilemez
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inci-repo-fallback-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  });

  // Gerçek yedek sözlük 17 MB; testte aynı şemayı taşıyan küçük bir fixture kullanılır.
  function writeFallbackDictionary(items) {
    fs.mkdirSync(path.join(tempDir, "data"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "data", "glossary.flagged.json"), JSON.stringify(items));
    process.chdir(tempDir);
  }

  test("Veritabanı erişilemezken önbellek yerel sözlükten doldurulmalı", async () => {
    writeFallbackDictionary([
      { name: "AQUA", cas: "7732-18-5", functions_tr: ["Çözücü"], flags: { banned: false }, note_tr: "Su" },
      { inci_name: "HYDROQUINONE", flags: { restricted: true }, eu_annex: { annex3: "Ref 14" } },
      { flags: {} }
    ]);
    const repository = new MongoIngredientRepository();

    await repository.ensureCache();

    assert.equal(repository.initialized, true, "yedek sözlük yüklendiyse önbellek hazır sayılmalı");
    assert.equal(repository.memoryCache.size, 2, "adı olmayan kayıt atlanmalı");
  });

  test("Yedek sözlüğün kısa bayrak şeması domain nesnesine taşınmalı", async () => {
    writeFallbackDictionary([
      { name: "HYDROQUINONE", flags: { restricted: true }, eu_annex: { annex3: "Ref 14" } },
      { name: "LINALOOL", flags: { allergen: true } }
    ]);
    const repository = new MongoIngredientRepository();

    const restricted = await repository.findByInciName("Hydroquinone");
    const allergen = await repository.findByInciName("Linalool");

    assert.equal(restricted.isRestricted(), true);
    assert.equal(restricted.euAnnex.annex3, "Ref 14");
    assert.equal(allergen.isAllergen(), true);
  });

  test("Yedek sözlükten gelen Türkçe alanlar korunmalı", async () => {
    writeFallbackDictionary([
      { name: "AQUA", functions: ["solvent"], functions_tr: ["Çözücü"], note_tr: "Su", flags: {} }
    ]);
    const repository = new MongoIngredientRepository();

    const aqua = await repository.findByInciName("Aqua");

    assert.deepEqual(aqua.functions, ["solvent"]);
    assert.deepEqual(aqua.functionsTr, ["Çözücü"]);
    assert.equal(aqua.noteTr, "Su");
  });

  test("Yedek sözlükte olmayan ad null dönmeli, istisna sızmamalı", async () => {
    writeFallbackDictionary([{ name: "AQUA", flags: {} }]);
    const repository = new MongoIngredientRepository();

    assert.equal(await repository.findByInciName("Zzztol"), null);
  });

  test("Yedek dosya da yokken repository çökmeden boş sonuç dönmeli", async () => {
    process.chdir(tempDir); // data/glossary.flagged.json hiç yok
    const repository = new MongoIngredientRepository();

    await repository.ensureCache();

    assert.equal(repository.memoryCache.size, 0);
    assert.equal(await repository.findByInciName("Aqua"), null);
    assert.deepEqual(await repository.search("aqua"), []);
    assert.equal((await repository.bulkFindByInciNames(["Aqua"])).size, 0);
  });

  test("Bozuk JSON yedeği uygulamayı çökertmemeli", async () => {
    fs.mkdirSync(path.join(tempDir, "data"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "data", "glossary.flagged.json"), "{ bu gecerli JSON degil");
    process.chdir(tempDir);
    const repository = new MongoIngredientRepository();

    await repository.ensureCache();

    assert.equal(repository.memoryCache.size, 0);
    assert.equal(await repository.findByInciName("Aqua"), null);
  });
});
