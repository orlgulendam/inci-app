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
