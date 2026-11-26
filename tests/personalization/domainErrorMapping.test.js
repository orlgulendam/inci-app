// tests/personalization/domainErrorMapping.test.js
// Gerileme testi: is kurali ihlalleri 500 degil, anlamli mesajli 400 donmeli.
const test = require("node:test");
const assert = require("node:assert/strict");

const ProfileService = require("../../src/modules/personalization/application/services/ProfileService");
const User = require("../../src/modules/personalization/domain/entities/User");

function createServiceWithUser(user) {
  const repo = {
    async findById() { return user; },
    async save() { return user.id; }
  };
  return new ProfileService(repo);
}

test("Gecersiz rutin turu 400 VALIDATION_ERROR dondurmeli", async () => {
  const user = new User({ id: "u1", email: "a@b.com", passwordHash: "x" });
  const service = createServiceWithUser(user);

  await assert.rejects(
    () => service.completeRoutine("u1", "ogle"),
    (err) => {
      assert.strictEqual(err.statusCode, 400, "HTTP 400 beklenir");
      assert.strictEqual(err.errorCode, "VALIDATION_ERROR");
      assert.match(err.message, /rutin türü/i, "Domain mesaji korunmali");
      return true;
    }
  );
});

test("Bos urun adiyla dolaba ekleme 400 dondurmeli", async () => {
  const user = new User({ id: "u1", email: "a@b.com", passwordHash: "x" });
  const service = createServiceWithUser(user);

  await assert.rejects(
    () => service.addVanityItem("u1", { name: "   ", paoMonths: 6 }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Ürün adı/i);
      return true;
    }
  );
});

test("7 gunden kisa seride sandik acma 400 ve seri bilgisi dondurmeli", async () => {
  const user = new User({ id: "u1", email: "a@b.com", passwordHash: "x", streakCount: 2 });
  const service = createServiceWithUser(user);

  await assert.rejects(
    () => service.claimOysterChest("u1"),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /7 günlük seri/i, "Kullaniciya gercek sebep soylenmeli");
      assert.match(err.message, /2/, "Mevcut seri sayisi mesajda yer almali");
      return true;
    }
  );
});

test("Gecerli rutin tamamlama hala calismali", async () => {
  const user = new User({ id: "u1", email: "a@b.com", passwordHash: "x" });
  const service = createServiceWithUser(user);

  const result = await service.completeRoutine("u1", "morning");
  assert.strictEqual(result.status, "COMPLETED");
  assert.ok(result.pointsAwarded > 0, "Puan verilmeli");
});
