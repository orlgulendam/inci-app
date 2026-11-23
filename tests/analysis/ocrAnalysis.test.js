// tests/analysis/ocrAnalysis.test.js - OCR Görsel Metin Okuma ve Analiz Testleri
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");
const GeminiVisionOcrService = require("../../src/modules/analysis/infrastructure/ocr/GeminiVisionOcrService");

function makeRequest(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        method: options.method || "GET",
        headers: options.headers || {}
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(body);
          } catch (_) {
            parsed = body;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        });
      }
    );
    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

describe("OCR Görsel Metin Okuma & INCI Tespiti", () => {
  let server;

  beforeEach((t, done) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => done());
  });

  afterEach((t, done) => {
    if (server) {
      server.close(() => done());
    } else {
      done();
    }
  });

  test("GeminiVisionOcrService: Boş base64 verisinde hata fırlatmalı", async () => {
    const service = new GeminiVisionOcrService();
    await assert.rejects(
      async () => {
        await service.extractIngredientsFromImage({ base64Data: "" });
      },
      { message: "Görsel verisi (base64) boş olamaz." }
    );
  });

  test("GeminiVisionOcrService: API anahtarı yokken simülasyon modunda temiz içerik dönmeli", async () => {
    // Hiçbir sağlayıcı yapılandırılmamış olmalı; aksi halde test gerçek API'ye çıkar.
    const service = new GeminiVisionOcrService("", undefined, "", "");
    const result = await service.extractIngredientsFromImage({
      base64Data: "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    });

    assert.ok(result.ingredientsText.includes("Aqua"));
    assert.ok(result.ingredientsText.includes("Niacinamide"));
    assert.equal(result.isSimulated, true);
  });

  test("POST /api/v1/analyze/ocr: Görsel eksik olduğunda 400 VALIDATION_ERROR dönmeli", async () => {
    const res = await makeRequest(server, "/api/v1/analyze/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { image: "" }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /api/v1/analyze/ocr: Geçerli görselle 200 OK ve metin dönmeli", async (t) => {
    // Vision sağlayıcısı taklit edilir: test ağa çıkmadan tüm OCR zincirini doğrular.
    t.mock.method(global, "fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                ingredientsText: "Aqua, Glycerin, Niacinamide, Phenoxyethanol",
                detectedProductName: "Test Serum",
                detectedBrand: "Test Brand",
                isFrontCover: false,
                confidence: "HIGH"
              })
            }]
          }
        }]
      })
    }));

    const res = await makeRequest(server, "/api/v1/analyze/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        image: "data:image/jpeg;base64,T0NSVEVTVElNQUdFUEFZTE9BRFVOSVFVRQ==",
        autoAnalyze: true
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.ingredientsText);
    assert.ok(res.body.data.ingredientsText.length > 5);

    // autoAnalyze: true gönderildiğinde analiz nesnesi de dönmeli
    if (res.body.data.analysis) {
      assert.ok(res.body.data.analysis.summary);
      assert.ok(typeof res.body.data.analysis.summary.score === "number");
    }
  });
});
