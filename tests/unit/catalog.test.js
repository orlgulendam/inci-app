// tests/unit/catalog.test.js - Catalog Modülü Birim ve Entegrasyon Testleri
const test = require("node:test");
const assert = require("node:assert/strict");

const Barcode = require("../../src/modules/catalog/domain/value-objects/Barcode");
const Product = require("../../src/modules/catalog/domain/entities/Product");
const IProductRepository = require("../../src/modules/catalog/infrastructure/repositories/IProductRepository");
const IBrandRepository = require("../../src/modules/catalog/infrastructure/repositories/IBrandRepository");
const ProductService = require("../../src/modules/catalog/application/services/ProductService");
const eventBus = require("../../src/core/events/eventBus");
const app = require("../../src/app");

// 1. Barcode Value Object Testi
test("Catalog: Barcode VO geçersiz barkodlarda hata fırlatmalı, 8-14 haneli rakamları kabul etmeli", () => {
  // Geçerli barkodlar
  const b1 = new Barcode("8682536069403");
  assert.equal(b1.getValue(), "8682536069403");

  const b2 = new Barcode("  12345678  ");
  assert.equal(b2.getValue(), "12345678");

  // Geçersiz barkodlar
  assert.throws(() => new Barcode("abc"), /Geçersiz barkod formatı/);
  assert.throws(() => new Barcode("12345"), /Geçersiz barkod formatı/);
  assert.throws(() => new Barcode("1234567890123456"), /Geçersiz barkod formatı/);
});

// 2. Mock Repository & Mock AnalysisFacade ile ProductService Testi (DIP & Facade Entegrasyonu)
class MockProductRepository extends IProductRepository {
  constructor() {
    super();
    this.products = new Map();
  }

  async findByBarcode(barcode) {
    return this.products.get(barcode) || null;
  }

  async search({ query, limit = 20, page = 1 }) {
    const list = Array.from(this.products.values());
    return {
      items: list.slice(0, limit),
      meta: { total: list.length, page, limit, totalPages: 1 }
    };
  }

  async save(product) {
    this.products.set(product.getBarcodeValue(), product);
    return product.id || "mock-id-123";
  }
}

class MockBrandRepository extends IBrandRepository {
  async findAll() {
    return { items: [], meta: { total: 0 } };
  }
}

test("Catalog: ProductService ürünü kaydederken analysisFacade üzerinden analiz yapmalı ve EventBus yayınlamalı", async () => {
  const prodRepo = new MockProductRepository();
  const brandRepo = new MockBrandRepository();

  let analyzeCalled = false;
  const mockAnalysisFacade = {
    analyzeText: async (text) => {
      analyzeCalled = true;
      return {
        summary: { score: 95, status: "CLEAN", isClean: true },
        items: [{ raw: "Aqua", clean: "Aqua", matched: true }]
      };
    }
  };

  const service = new ProductService(prodRepo, brandRepo, mockAnalysisFacade);

  const eventPromise = new Promise((resolve) => {
    eventBus.subscribe("product.updated", (event) => {
      resolve(event);
    });
  });

  const result = await service.createOrUpdate({
    barcode: "8682536069403",
    productName: "Arbutin Serum",
    brandName: "The Purest Solutions",
    rawIngredientsText: "Aqua, Glycerin, Alpha-Arbutin"
  });

  const event = await eventPromise;
  assert.equal(event.barcode, "8682536069403");
  assert.equal(analyzeCalled, true, "analysisFacade.analyzeText çağrılmış olmalı");
  assert.equal(result.product.productName, "Arbutin Serum");
  assert.equal(result.product.safetySummary.score, 95);
  assert.equal(result.product.ingredientsSummary.length, 1);
});

// 3. HTTP Entegrasyon Testleri (Express Uç Noktaları)
test("Catalog: GET /api/v1/products/:barcode olmayan barkod için 404 NOT_FOUND dönmeli", async () => {
  const server = app.listen(3095);
  try {
    const res = await fetch("http://localhost:3095/api/v1/products/9999999999999");
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "NOT_FOUND");
  } finally {
    server.close();
  }
});

test("Catalog: GET /api/v1/products/search sayfalama ve standart meta nesnesi dönmeli", async () => {
  const server = app.listen(3094);
  try {
    const res = await fetch("http://localhost:3094/api/v1/products/search?limit=5");
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.meta);
    assert.equal(body.meta.limit, 5);
  } finally {
    server.close();
  }
});

test("Catalog: GET /api/v1/brands marka listesini 200 OK ile dönmeli", async () => {
  const server = app.listen(3093);
  try {
    const res = await fetch("http://localhost:3093/api/v1/brands");
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  } finally {
    server.close();
  }
});
