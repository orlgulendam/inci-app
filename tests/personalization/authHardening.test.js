// tests/personalization/authHardening.test.js
// Gerileme testleri: kayit/parola sifirlama uc noktalarinin guvenlik sertlestirmeleri.
const test = require("node:test");
const assert = require("node:assert");

const AuthService = require("../../src/modules/personalization/application/services/AuthService");
const AuthController = require("../../src/modules/personalization/presentation/controllers/AuthController");

function createUserRepositoryStub() {
  const saved = [];
  return {
    saved,
    async findByEmail() { return null; },
    async findByResetToken() { return null; },
    async save(user) {
      saved.push(user);
      user.id = user.id || "test-user-id";
      return user.id;
    }
  };
}

test("AuthService.register istemciden gelen role alanini yok saymali", async () => {
  const repo = createUserRepositoryStub();
  const service = new AuthService(repo);

  const result = await service.register({
    email: "saldirgan@example.com",
    password: "Parola123",
    role: "admin"
  });

  assert.strictEqual(result.role, "user", "Kayit yaniti admin rolu dondurmemeli");
  assert.strictEqual(repo.saved[0].role, "user", "Veritabanina admin rolu yazilmamali");
});

test("AuthController.register role alanini servise hic iletmemeli", async () => {
  let receivedPayload = null;
  const controller = new AuthController({
    async register(payload) {
      receivedPayload = payload;
      return { id: "1", email: payload.email, role: "user" };
    }
  });

  const req = { body: { email: "a@b.com", password: "Parola123", role: "admin" } };
  const res = { status() { return this; }, json() { return this; } };
  await controller.register(req, res, (err) => { throw err; });

  assert.ok(receivedPayload, "Servis cagrilmali");
  assert.strictEqual(receivedPayload.role, undefined, "role alani servise gecmemeli");
});

test("Uretim ortaminda forgot-password yaniti resetToken dondurmemeli", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  // config ve AuthService uretim bayragiyla yeniden yuklenir
  delete require.cache[require.resolve("../../src/core/config/env")];
  delete require.cache[require.resolve("../../src/modules/personalization/application/services/AuthService")];
  const ProdAuthService = require("../../src/modules/personalization/application/services/AuthService");

  try {
    const user = {
      id: "u1",
      email: "kurban@example.com",
      setPasswordResetToken() {}
    };
    const repo = {
      async findByEmail() { return user; },
      async save() { return user.id; }
    };
    const service = new ProdAuthService(repo);
    const result = await service.forgotPassword("kurban@example.com");

    assert.strictEqual(result.resetToken, undefined, "Uretimde resetToken yanitla donmemeli");
    assert.ok(result.message, "Genel bilgilendirme mesaji yine donmeli");
  } finally {
    process.env.NODE_ENV = originalEnv;
    delete require.cache[require.resolve("../../src/core/config/env")];
    delete require.cache[require.resolve("../../src/modules/personalization/application/services/AuthService")];
  }
});

test("Uretim disinda resetToken gelistirme kolayligi icin donmeye devam etmeli", async () => {
  const user = {
    id: "u1",
    email: "gelistirici@example.com",
    setPasswordResetToken() {}
  };
  const repo = {
    async findByEmail() { return user; },
    async save() { return user.id; }
  };
  const service = new AuthService(repo);
  const result = await service.forgotPassword("gelistirici@example.com");

  assert.ok(result.resetToken, "Gelistirme ortaminda belirtec donmeli");
});
