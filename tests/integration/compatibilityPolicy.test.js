// tests/integration/compatibilityPolicy.test.js
// Seçenek A yetkilendirme politikası + "sahte 100 puan" regresyonu + yanıt sözleşmesi.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");
const CompatibilityService = require("../../src/modules/personalization/application/services/CompatibilityService");
const SkinProfile = require("../../src/modules/personalization/domain/value-objects/SkinProfile");

function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path,
        method: options.method || "GET",
        headers: options.headers || {}
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let parsed = null;
          try { parsed = JSON.parse(body); } catch (_) { parsed = body; }
          resolve({ statusCode: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

describe("Seçenek A: Kişiselleştirilmiş uyumluluk analizi yetkilendirmesi", () => {
  let server;

  test("setup", (t, done) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => done());
  });

  test("Misafir POST /api/v1/profile/check-compatibility -> 401 UNAUTHORIZED", async () => {
    const res = await request(server, "/api/v1/profile/check-compatibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { rawIngredientsText: "Aqua, Glycerin, Niacinamide" }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  test("Misafir inlineProfile göndererek politikayı atlayamamalı", async () => {
    const res = await request(server, "/api/v1/profile/check-compatibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        rawIngredientsText: "Aqua, Glycerin",
        inlineProfile: { skinType: "dry" }
      }
    });

    assert.equal(res.statusCode, 401, "inlineProfile authMiddleware'i atlatmamalı");
  });

  test("Misafir genel güvenlik analizini (POST /api/v1/analyze) kullanabilmeli", async () => {
    const res = await request(server, "/api/v1/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { ingredientsText: "Aqua, Glycerin, Niacinamide, Phenoxyethanol" }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.summary.score === "number");
  });

  test("teardown", (t, done) => {
    server.close(() => done());
  });
});

describe("CompatibilityService: içerik verisi yokken sahte puan üretilmemeli", () => {
  function buildService({ ingredientsText = "", summary = [] } = {}) {
    const profile = new SkinProfile({ skinType: "hassas", allergicIngredients: ["Parabens"] });
    const userRepository = {
      findById: async () => ({ id: "u1", skinProfile: profile })
    };
    const catalogFacade = {
      getProductByBarcode: async () => ({
        productName: "Test Ürün",
        brandName: "Test Marka",
        imageUrl: null,
        rawIngredientsText: ingredientsText,
        ingredientsSummary: summary
      })
    };
    return new CompatibilityService(userRepository, null, catalogFacade, null);
  }

  test("İçeriği boş üründe INSUFFICIENT_DATA dönmeli, 100 puan verilmemeli", async () => {
    const service = buildService({ ingredientsText: "" });
    const result = await service.checkProductCompatibility({ userId: "u1", barcode: "8690000000001" });

    assert.equal(result.hasIngredients, false);
    assert.equal(result.status, "INSUFFICIENT_DATA");
    assert.equal(result.compatibility, null, "skor nesnesi üretilmemeli");
    assert.equal(result.evaluation, null);
    assert.ok(result.message.length > 0);
  });

  test("İçeriği olan üründe gerçek skor ve standart DTO dönmeli", async () => {
    const service = buildService({ ingredientsText: "Aqua, Glycerin, Methylparaben" });
    const result = await service.checkProductCompatibility({ userId: "u1", barcode: "8690000000002" });

    assert.equal(result.hasIngredients, true);
    assert.ok(result.product.productName, "product.productName dolu olmalı");
    assert.ok(result.compatibility, "compatibility nesnesi dolu olmalı");
    assert.equal(typeof result.compatibility.compatibilityScore, "number");

    // Kullanıcı "Parabens" alerjenini seçmişti; Methylparaben yakalanmalı
    assert.ok(
      result.compatibility.matchedAllergens.includes("METHYLPARABEN"),
      `alerjen yakalanmalı, gelen: ${JSON.stringify(result.compatibility.matchedAllergens)}`
    );
    assert.ok(result.compatibility.compatibilityScore < 100, "alerjen varken 100 puan olamaz");
  });

  test("Giriş yapmamış ve profili olmayan çağrı UnauthorizedError fırlatmalı", async () => {
    const service = buildService({ ingredientsText: "Aqua" });
    await assert.rejects(
      () => service.checkProductCompatibility({ barcode: "8690000000003" }),
      (err) => err.statusCode === 401 || err.code === "UNAUTHORIZED"
    );
  });
});
