// tests/unit/community.test.js - Community Modülü Birim ve Entegrasyon Testleri
const test = require("node:test");
const assert = require("node:assert/strict");

const Contribution = require("../../src/modules/community/domain/entities/Contribution");
const ContributionStatus = require("../../src/modules/community/domain/value-objects/ContributionStatus");
const IContributionRepository = require("../../src/modules/community/infrastructure/repositories/IContributionRepository");
const ContributionService = require("../../src/modules/community/application/services/ContributionService");
const eventBus = require("../../src/core/events/eventBus");
const app = require("../../src/app");

// 1. Contribution Entity ve State Transition Testi
test("Community: Contribution varlığı durum geçişlerini doğru işletmeli", () => {
  const c = new Contribution({
    userId: "usr-123",
    barcode: "8680000000001",
    productName: "Test Nemlendirici",
    brandName: "Test Marka"
  });

  assert.equal(c.status.isPending(), true);

  c.approve("Ambalaj ve içerik teyit edildi.");
  assert.equal(c.status.isApproved(), true);
  assert.ok(c.reviewedAt);

  // Zaten onaylanmış bir katkı tekrar onaylanamaz / reddedilemez
  assert.throws(() => c.approve(), /Sadece 'pending' durumundaki katkılar onaylanabilir/);
  assert.throws(() => c.reject("sebep"), /Sadece 'pending' durumundaki katkılar reddedilebilir/);
});

// 2. Mock Repositories ile Multi-Document ACID Transaction ve Facade Orkestrasyon Testi
class MockContributionRepository extends IContributionRepository {
  constructor() {
    super();
    this.contributions = new Map();
  }

  async findById(id) {
    return this.contributions.get(id) || null;
  }

  async findPending() {
    const list = Array.from(this.contributions.values()).filter(c => c.status.isPending());
    return { items: list, meta: { total: list.length, page: 1, limit: 20 } };
  }

  async save(contribution) {
    contribution.id = contribution.id || "contrib-999";
    this.contributions.set(contribution.id, contribution);
    return contribution.id;
  }
}

test("Community: approveContribution() ACID akışı kataloğa eklemeli, 50 puan vermeli ve EventBus tetiklemeli", async () => {
  const repo = new MockContributionRepository();

  const contrib = new Contribution({
    id: "contrib-999",
    userId: "user-abc",
    barcode: "8680000000002",
    productName: "Gül Suyu Tonik",
    brandName: "Doğal Marka",
    rawIngredientsText: "Rosa Damascena Flower Water"
  });
  await repo.save(contrib);

  let productIngested = false;
  const mockCatalogFacade = {
    createProductFromContribution: async (data) => {
      productIngested = true;
      assert.equal(data.barcode, "8680000000002");
    }
  };

  let pointsAwarded = 0;
  const mockPersonalizationFacade = {
    addRewardPoints: async (userId, points) => {
      assert.equal(userId, "user-abc");
      pointsAwarded = points;
    }
  };

  // Mock transaction runner (gerçek MongoDB olmadan ACID akışını simüle eder)
  const mockTransactionRunner = async (work) => {
    return work("mock-session");
  };

  const service = new ContributionService(
    repo,
    mockCatalogFacade,
    mockPersonalizationFacade,
    mockTransactionRunner
  );

  const eventPromise = new Promise((resolve) => {
    eventBus.subscribe("contribution.approved", (event) => {
      resolve(event);
    });
  });

  const result = await service.approveContribution({
    contributionId: "contrib-999",
    reviewerNote: "Resmi etiketle doğrulandı."
  });

  const event = await eventPromise;
  assert.equal(event.contributionId, "contrib-999");
  assert.equal(event.rewardPoints, 50);

  assert.equal(result.success, true);
  assert.equal(result.rewardAwarded, 50);
  assert.equal(productIngested, true, "Kataloğa eklenmiş olmalı");
  assert.equal(pointsAwarded, 50, "Kullanıcıya 50 puan tanımlanmış olmalı");

  const updatedContrib = await repo.findById("contrib-999");
  assert.equal(updatedContrib.status.isApproved(), true);
});

// 3. HTTP Entegrasyon Testleri
test("Community: POST /api/v1/contributions yetkisiz kullanıcıda 401 UNAUTHORIZED dönmeli", async () => {
  const server = app.listen(3090);
  try {
    const res = await fetch("http://localhost:3090/api/v1/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcode: "8680000000003",
        productName: "Test Krem"
      })
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "UNAUTHORIZED");
  } finally {
    server.close();
  }
});

test("Community: GET /api/v1/contributions/pending onay bekleyen listeyi dönmeli", async () => {
  const server = app.listen(3089);
  try {
    const res = await fetch("http://localhost:3089/api/v1/contributions/pending");
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.meta);
  } finally {
    server.close();
  }
});
