// tests/analysis/ingredientEndpoints.test.js - Kimyasal Sözlük Uç Noktaları
// Odak: GET /api/v1/ingredients/search ve GET /api/v1/ingredients/:inci uç noktaları
// hiçbir testte kapsanmıyordu. Controller doğrudan sahte repository ile çağrılır;
// gerçek MongoDB veya ağ kullanılmaz.
// Kapsam: parametre doğrulaması, 404 sözleşmesi, sparse fieldsets (fields), limit
// aktarımı, standart yanıt zarfı ve repository hatalarının hata orta katmanına devri.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const initializeAnalysisModule = require("../../src/modules/analysis");
const Ingredient = require("../../src/modules/analysis/domain/entities/Ingredient");

const NIACINAMIDE = new Ingredient({
  inciName: "NIACINAMIDE",
  casNumber: "98-92-0",
  functionsTr: ["Cilt Bakım", "Yumuşatıcı"],
  noteTr: "Gözenek görünümünü azaltır."
});
const NIACIN = new Ingredient({ inciName: "NIACIN", casNumber: "59-67-6" });

// Controller'ı sahte repository ile çağırır; yanıtı ya da next()'e giden hatayı döndürür.
function callController(method, request, repositoryOverrides = {}) {
  const repository = {
    findByInciName: async () => null,
    search: async () => [],
    bulkFindByInciNames: async () => new Map(),
    ...repositoryOverrides
  };

  const { controller } = initializeAnalysisModule({
    repository,
    ocrService: { extractIngredientsFromImage: async () => ({ ingredientsText: "" }) }
  });

  return new Promise((resolve) => {
    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      }
    };
    const req = { query: {}, params: {}, body: {}, ...request };
    controller[method](req, res, (err) => resolve({ error: err }));
  });
}

describe("GET /ingredients/search: Parametre Doğrulaması", () => {
  test("Arama terimi iki karakterden kısaysa 400 VALIDATION_ERROR dönmeli", async () => {
    for (const q of ["", "a", "  "]) {
      const { error } = await callController("searchIngredients", { query: { q } });

      assert.ok(error, `${JSON.stringify(q)} için doğrulama hatası beklenir`);
      assert.equal(error.errorCode, "VALIDATION_ERROR");
      assert.equal(error.statusCode, 400);
    }
  });

  test("q parametresi hiç gönderilmediğinde de doğrulama hatası dönmeli", async () => {
    const { error } = await callController("searchIngredients", { query: {} });

    assert.equal(error.errorCode, "VALIDATION_ERROR");
    assert.deepEqual(error.details, [{ field: "q", message: "q parametresi en az 2 karakter olmalıdır." }]);
  });

  test("Doğrulama hatası repository'ye hiç gitmeden üretilmeli", async () => {
    let searched = false;
    await callController("searchIngredients", { query: { q: "a" } }, {
      search: async () => {
        searched = true;
        return [];
      }
    });

    assert.equal(searched, false, "geçersiz sorgu için veritabanına gidilmemeli");
  });
});

describe("GET /ingredients/search: Başarılı Arama", () => {
  test("Eşleşen kimyasallar standart zarf ve meta ile dönmeli", async () => {
    const res = await callController("searchIngredients", { query: { q: "niacin" } }, {
      search: async () => [NIACINAMIDE, NIACIN]
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 2);
    assert.deepEqual(res.body.meta, { total: 2, query: "niacin" });
    assert.equal(res.body.data[0].inciName, "NIACINAMIDE");
  });

  test("Sorgu terimi repository'ye kırpılmış olarak geçmeli", async () => {
    const seen = [];
    await callController("searchIngredients", { query: { q: "  ni  " } }, {
      search: async (query, limit) => {
        seen.push({ query, limit });
        return [];
      }
    });

    assert.deepEqual(seen, [{ query: "ni", limit: 20 }]);
  });

  test("Meta içindeki query kırpılmış terimi yansıtmalı", async () => {
    const res = await callController("searchIngredients", { query: { q: "  ni  " } }, {
      search: async () => [NIACIN]
    });

    assert.equal(res.body.meta.query, "ni");
  });

  test("limit parametresi repository'ye aktarılmalı", async () => {
    const seen = [];
    await callController("searchIngredients", { query: { q: "niacin", limit: "5" } }, {
      search: async (query, limit) => {
        seen.push(limit);
        return [];
      }
    });

    assert.deepEqual(seen, [5]);
  });

  test("Geçersiz limit varsayılan 20'ye düşmeli", async () => {
    const seen = [];
    for (const limit of ["abc", "", "0"]) {
      await callController("searchIngredients", { query: { q: "niacin", limit } }, {
        search: async (query, parsedLimit) => {
          seen.push(parsedLimit);
          return [];
        }
      });
    }

    assert.deepEqual(seen, [20, 20, 20], "ayrıştırılamayan limit varsayılana dönmeli");
  });

  test("Sonuç bulunamadığında boş dizi ve 200 dönmeli", async () => {
    const res = await callController("searchIngredients", { query: { q: "zzztol" } });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.meta.total, 0);
  });

  test("fields parametresi yalnızca istenen alanları döndürmeli", async () => {
    const res = await callController("searchIngredients", { query: { q: "niacin", fields: "inciName" } }, {
      search: async () => [NIACINAMIDE, NIACIN]
    });

    assert.deepEqual(res.body.data, [{ inciName: "NIACINAMIDE" }, { inciName: "NIACIN" }]);
  });

  test("fields olmadan tüm alanlar dönmeli", async () => {
    const res = await callController("searchIngredients", { query: { q: "niacin" } }, {
      search: async () => [NIACINAMIDE]
    });

    const [item] = res.body.data;
    assert.equal(item.casNumber, "98-92-0");
    assert.deepEqual(item.functionsTr, ["Cilt Bakım", "Yumuşatıcı"]);
    assert.ok("flags" in item);
    assert.ok("euAnnex" in item);
  });
});

describe("GET /ingredients/:inci: Tek Kimyasal Getirme", () => {
  test("Bulunan kimyasal standart zarfla dönmeli", async () => {
    const res = await callController("getIngredientByInci", { params: { inci: "Niacinamide" } }, {
      findByInciName: async () => NIACINAMIDE
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.inciName, "NIACINAMIDE");
    assert.equal(res.body.data.noteTr, "Gözenek görünümünü azaltır.");
  });

  test("Sözlükte olmayan kimyasal için 404 NOT_FOUND dönmeli", async () => {
    const { error } = await callController("getIngredientByInci", { params: { inci: "Zzztol" } });

    assert.ok(error);
    assert.equal(error.errorCode, "NOT_FOUND");
    assert.equal(error.statusCode, 404);
  });

  test("404 mesajı aranan adı içermeli", async () => {
    const { error } = await callController("getIngredientByInci", { params: { inci: "Zzztol" } });

    assert.ok(error.message.includes("Zzztol"), `mesaj aranan adı içermeli: ${error.message}`);
  });

  test("URL parametresi repository'ye olduğu gibi geçmeli", async () => {
    const seen = [];
    await callController("getIngredientByInci", { params: { inci: "Sodium Hyaluronate" } }, {
      findByInciName: async (name) => {
        seen.push(name);
        return NIACINAMIDE;
      }
    });

    assert.deepEqual(seen, ["Sodium Hyaluronate"]);
  });

  test("fields parametresi tek kimyasalda da uygulanmalı", async () => {
    const res = await callController("getIngredientByInci", {
      params: { inci: "Niacinamide" },
      query: { fields: "inciName,casNumber" }
    }, { findByInciName: async () => NIACINAMIDE });

    assert.deepEqual(res.body.data, { inciName: "NIACINAMIDE", casNumber: "98-92-0" });
  });

  test("Bilinmeyen alan adı istendiğinde boş nesne dönmeli, hata olmamalı", async () => {
    const res = await callController("getIngredientByInci", {
      params: { inci: "Niacinamide" },
      query: { fields: "nonexistentField" }
    }, { findByInciName: async () => NIACINAMIDE });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, {});
  });
});

describe("Kimyasal Uç Noktaları: Repository Hataları", () => {
  test("Arama sırasında repository hatası hata orta katmanına devredilmeli", async () => {
    const { error } = await callController("searchIngredients", { query: { q: "niacin" } }, {
      search: async () => {
        throw new Error("veritabanı erişilemez");
      }
    });

    assert.ok(error instanceof Error);
    assert.match(error.message, /erişilemez/);
  });

  test("Tek kimyasal getirirken repository hatası devredilmeli", async () => {
    const { error } = await callController("getIngredientByInci", { params: { inci: "Niacinamide" } }, {
      findByInciName: async () => {
        throw new Error("veritabanı erişilemez");
      }
    });

    assert.ok(error instanceof Error);
    assert.match(error.message, /erişilemez/);
  });

  test("Repository hatası istemciye 200 olarak sızmamalı", async () => {
    const result = await callController("searchIngredients", { query: { q: "niacin" } }, {
      search: async () => {
        throw new Error("veritabanı erişilemez");
      }
    });

    assert.equal(result.statusCode, undefined, "hata durumunda yanıt gönderilmemeli");
    assert.equal(result.body, undefined);
  });
});
