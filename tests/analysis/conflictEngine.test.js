// tests/analysis/conflictEngine.test.js - Kimyasal Çakışma Motoru ve API Testleri
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const IngredientConflictEngine = require("../../src/modules/analysis/domain/services/IngredientConflictEngine");
const app = require("../../src/app");

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

describe("Kimyasal Çakışma & Bariyer Koruma Motoru (IngredientConflictEngine)", () => {
  const engine = new IngredientConflictEngine();

  test("Retinol ve Glikolik Asit (AHA) çakışmasını HIGH risk olarak tespit etmeli", () => {
    const listA = ["Water", "Glycerin", "Retinol", "Dimethicone"];
    const listB = ["Water", "Glycolic Acid", "Sodium Hydroxide"];

    const result = engine.detectConflicts(listA, listB);

    assert.equal(result.hasConflicts, true);
    assert.equal(result.overallRisk, "HIGH");
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].ruleId, "RETINOID_AND_DIRECT_ACIDS");
    assert.equal(result.conflicts[0].severity, "HIGH");
    assert.ok(result.conflicts[0].dermatologistAdvice.includes("Skin Cycling"));
  });

  test("Tek ürün içindeki çakışan maddeleri yakalamalı", () => {
    const singleProduct = ["Aqua", "Salicylic Acid", "Retinal", "Phenoxyethanol"];
    const result = engine.detectConflicts(singleProduct);

    assert.equal(result.hasConflicts, true);
    assert.equal(result.overallRisk, "HIGH");
    assert.equal(result.conflicts[0].ruleId, "RETINOID_AND_DIRECT_ACIDS");
  });

  test("Saf C Vitamini ve Salisilik Asit (BHA) çakışmasını MEDIUM risk olarak belirlemeli", () => {
    const listA = ["Aqua", "Ascorbic Acid", "Ferulic Acid"];
    const listB = ["Aqua", "Salicylic Acid", "Niacinamide"];

    const result = engine.detectConflicts(listA, listB);

    assert.equal(result.hasConflicts, true);
    assert.ok(result.conflicts.some((c) => c.ruleId === "PURE_VITAMIN_C_AND_DIRECT_ACIDS"));
    assert.equal(result.overallRisk, "MEDIUM");
  });

  test("Uyumlu ve güvenli içeriklerde SAFE dönmeli", () => {
    const listA = ["Water", "Hyaluronic Acid", "Ceramide NP", "Glycerin"];
    const listB = ["Centella Asiatica Extract", "Panthenol", "Madecassoside"];

    const result = engine.detectConflicts(listA, listB);

    assert.equal(result.hasConflicts, false);
    assert.equal(result.conflictCount, 0);
    assert.equal(result.overallRisk, "SAFE");
  });
});

describe("POST /api/v1/analyze/conflicts Entegrasyon Testi", () => {
  let server;

  before((done) => {
    server = http.createServer(app);
    server.listen(0, done);
  });

  after((done) => {
    server.close(done);
  });

  test("POST /api/v1/analyze/conflicts - Geçerli iki ürün içeriği ile 200 ve çakışma raporu dönmeli", async () => {
    const res = await makeRequest(server, "/api/v1/analyze/conflicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        ingredientsA: ["Water", "Retinol"],
        ingredientsB: ["Water", "Glycolic Acid"]
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.hasConflicts, true);
    assert.equal(res.body.data.overallRisk, "HIGH");
  });

  test("POST /api/v1/analyze/conflicts - Boş gövdede 400 VALIDATION_ERROR dönmeli", async () => {
    const res = await makeRequest(server, "/api/v1/analyze/conflicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {}
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });
});
