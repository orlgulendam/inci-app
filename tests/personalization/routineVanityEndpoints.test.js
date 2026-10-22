// tests/personalization/routineVanityEndpoints.test.js - Rutin, Dolap ve Sandık API Yetkilendirme Testleri
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");
const User = require("../../src/modules/personalization/domain/entities/User");
const ProfileService = require("../../src/modules/personalization/application/services/ProfileService");

class MockUserRepo {
  constructor() {
    this.users = new Map();
  }
  async findById(id) {
    return this.users.get(String(id)) || null;
  }
  async save(user) {
    this.users.set(String(user.id), user);
    return user.id;
  }
  async deleteById(id) {
    return this.users.delete(String(id));
  }
}

describe("Rutin ve Dolap ProfileService Birim Mantığı", () => {
  test("ProfileService.completeRoutine Sabah ve Akşam ödüllerini doğru işletmeli", async () => {
    const repo = new MockUserRepo();
    const service = new ProfileService(repo);

    const user = new User({
      id: "u-101",
      email: "service_test@inci.app",
      points: 20
    });
    await repo.save(user);

    // Sabah tamamla
    const resM = await service.completeRoutine("u-101", "morning");
    assert.equal(resM.status, "COMPLETED");
    assert.equal(resM.pointsAwarded, 3);
    assert.equal(resM.points, 23);

    // Akşam tamamla (bonus ile)
    const resE = await service.completeRoutine("u-101", "evening");
    assert.equal(resE.status, "COMPLETED");
    assert.equal(resE.pointsAwarded, 5); // +3 + 2 bonus
    assert.equal(resE.points, 28);
  });

  test("ProfileService Dolap ekleme ve çıkarma akışı", async () => {
    const repo = new MockUserRepo();
    const service = new ProfileService(repo);

    const user = new User({
      id: "u-102",
      email: "vanity_test@inci.app"
    });
    await repo.save(user);

    // Dolaba ürün ekle
    const added = await service.addVanityItem("u-102", {
      name: "Glikolik Asit Tonik",
      brand: "The Ordinary",
      openedAt: new Date(),
      paoMonths: 6
    });
    assert.ok(added.id);

    // Dolabı sorgula
    const vanity = await service.getVanity("u-102");
    assert.equal(vanity.items.length, 1);
    assert.equal(vanity.items[0].name, "Glikolik Asit Tonik");
    assert.equal(vanity.items[0].status, "FRESH");

    // Dolaptan sil
    const delRes = await service.removeVanityItem("u-102", added.id);
    assert.equal(delRes.success, true);

    const vanityAfter = await service.getVanity("u-102");
    assert.equal(vanityAfter.items.length, 0);
  });
});

describe("API Yetkilendirme Korumaları (401 Unauthorized)", () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("GET /api/v1/personalization/routine - Token olmadan 401 dönmeli", async () => {
    const res = await fetch(`${baseUrl}/api/v1/personalization/routine`);
    assert.equal(res.status, 401);
  });

  test("GET /api/v1/personalization/vanity - Token olmadan 401 dönmeli", async () => {
    const res = await fetch(`${baseUrl}/api/v1/personalization/vanity`);
    assert.equal(res.status, 401);
  });

  test("POST /api/v1/personalization/chest/claim - Token olmadan 401 dönmeli", async () => {
    const res = await fetch(`${baseUrl}/api/v1/personalization/chest/claim`, {
      method: "POST"
    });
    assert.equal(res.status, 401);
  });
});
