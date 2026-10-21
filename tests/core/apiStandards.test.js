// tests/core/apiStandards.test.js - REST API Standartları, Rate Limiting, Sparse Fieldsets ve HTTP Caching Testleri
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");
const { createRateLimiter } = require("../../src/core/middlewares/rateLimiter");
const { pickFields, buildPaginationMeta, formatSuccessResponse } = require("../../src/core/utils/apiResponse");
const { TooManyRequestsError } = require("../../src/core/errors/AppError");

// Testler için basit HTTP istek yardımcısı
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

describe("REST API Standartları & İyileştirmeler", () => {
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

  test("Sparse Fieldsets (pickFields): Yalnızca talep edilen alanları ayıklamalı", () => {
    const single = { id: "123", barcode: "8690001", name: "Gül Suyu", secret: "gizli", price: 150 };
    const filteredSingle = pickFields(single, "barcode,name");
    assert.deepEqual(filteredSingle, { barcode: "8690001", name: "Gül Suyu" });
    assert.equal(filteredSingle.secret, undefined);
    assert.equal(filteredSingle.price, undefined);

    const list = [
      { id: "1", barcode: "8690001", name: "Krem", ignored: "x" },
      { id: "2", barcode: "8690002", name: "Serum", ignored: "y" }
    ];
    const filteredList = pickFields(list, "barcode,name");
    assert.equal(filteredList.length, 2);
    assert.deepEqual(filteredList[0], { barcode: "8690001", name: "Krem" });
    assert.equal(filteredList[0].ignored, undefined);
  });

  test("Sayfalama Meta (buildPaginationMeta): totalPages, hasNext ve hasPrev hesaplamalı", () => {
    const metaPage1 = buildPaginationMeta({ total: 45, page: 1, limit: 20 });
    assert.equal(metaPage1.total, 45);
    assert.equal(metaPage1.totalPages, 3);
    assert.equal(metaPage1.hasNext, true);
    assert.equal(metaPage1.hasPrev, false);

    const metaPage2 = buildPaginationMeta({ total: 45, page: 2, limit: 20 });
    assert.equal(metaPage2.hasNext, true);
    assert.equal(metaPage2.hasPrev, true);

    const metaPage3 = buildPaginationMeta({ total: 45, page: 3, limit: 20 });
    assert.equal(metaPage3.hasNext, false);
    assert.equal(metaPage3.hasPrev, true);
  });

  test("Rate Limiter Middleware: Limit aşıldığında 429 TOO_MANY_REQUESTS ve Retry-After dönmeli", (t, done) => {
    // 3 istek limitli test rate limiter'ı oluştur
    const limiter = createRateLimiter({
      windowMs: 5000,
      max: 3,
      skipInTest: false
    });

    const mockReq = { ip: "192.168.1.100" };
    const mockRes = {
      headers: {},
      setHeader(name, val) {
        this.headers[name] = val;
      }
    };

    let nextCallCount = 0;
    let caughtError = null;

    // 1. İstek (Geçer)
    limiter(mockReq, mockRes, () => nextCallCount++);
    assert.equal(nextCallCount, 1);
    assert.equal(mockRes.headers["X-RateLimit-Limit"], 3);
    assert.equal(mockRes.headers["X-RateLimit-Remaining"], 2);

    // 2. İstek (Geçer)
    limiter(mockReq, mockRes, () => nextCallCount++);
    assert.equal(nextCallCount, 2);
    assert.equal(mockRes.headers["X-RateLimit-Remaining"], 1);

    // 3. İstek (Geçer)
    limiter(mockReq, mockRes, () => nextCallCount++);
    assert.equal(nextCallCount, 3);
    assert.equal(mockRes.headers["X-RateLimit-Remaining"], 0);

    // 4. İstek (429 Hata fırlatmalı)
    limiter(mockReq, mockRes, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof TooManyRequestsError);
    assert.equal(caughtError.statusCode, 429);
    assert.equal(caughtError.errorCode, "TOO_MANY_REQUESTS");
    assert.ok(mockRes.headers["Retry-After"] > 0);
    done();
  });

  test("HTTP Caching: GET /api/v1/brands endpoint'i Cache-Control ve ETag başlıklarını dönmeli", async () => {
    const res = await makeRequest(server, "/api/v1/brands");
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["cache-control"], "Cache-Control başlığı mevcut olmalı");
    assert.ok(res.headers["cache-control"].includes("public"), "Cache public olmalı");
    assert.ok(res.headers["cache-control"].includes("max-age=43200"), "Cache 12 saat olmalı");
    assert.ok(res.headers["etag"], "ETag başlığı mevcut olmalı");
  });

  test("Sparse Fieldsets API: GET /api/v1/products/search?fields=barcode,productName yalnızca seçili alanları dönmeli", async () => {
    const res = await makeRequest(server, "/api/v1/products/search?limit=2&fields=barcode,productName");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.meta, "Meta nesnesi dönmeli");

    if (Array.isArray(res.body.data) && res.body.data.length > 0) {
      const firstItem = res.body.data[0];
      assert.ok("barcode" in firstItem, "barcode alanı olmalı");
      assert.ok("productName" in firstItem, "productName alanı olmalı");
      assert.equal(firstItem.imageUrl, undefined, "imageUrl filtrelenmiş olmalı");
      assert.equal(firstItem.safetySummary, undefined, "safetySummary filtrelenmiş olmalı");
    }
  });
});
