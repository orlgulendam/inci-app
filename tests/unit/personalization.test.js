// tests/unit/personalization.test.js - Personalization Modülü Birim ve Entegrasyon Testleri
const test = require("node:test");
const assert = require("node:assert/strict");

const SkinProfile = require("../../src/modules/personalization/domain/value-objects/SkinProfile");
const User = require("../../src/modules/personalization/domain/entities/User");
const SkinCompatibilityEngine = require("../../src/modules/personalization/domain/services/SkinCompatibilityEngine");
const IUserRepository = require("../../src/modules/personalization/infrastructure/repositories/IUserRepository");
const AuthService = require("../../src/modules/personalization/application/services/AuthService");
const app = require("../../src/app");

// 1. SkinProfile Value Object & Engine Testi (Dermatolojik Uyumluluk)
test("Personalization: SkinCompatibilityEngine kullanıcının cilt profilindeki hassasiyetleri doğru tespit etmeli", () => {
  const profile = new SkinProfile({
    skinType: "sensitive",
    conditions: ["eczema", "fragrance_sensitive", "fungal_acne"],
    allergicIngredients: ["NIACINAMIDE"]
  });

  assert.equal(profile.isAllergicTo("NIACINAMIDE"), true);
  assert.equal(profile.isAllergicTo("AQUA"), false);

  // Egzama, parfüm ve mantar aknesi tetikleyicileri içeren formül
  const testFormula = [
    "Aqua",
    "Glycerin",
    "Sodium Lauryl Sulfate",      // Egzama bariyer riski
    "Parfum",                     // Parfüm hassasiyeti riski
    "Polysorbate 20",             // Mantar aknesi riski
    "Niacinamide"                 // Kullanıcının şahsi alerjeni (CRITICAL)
  ];

  const report = SkinCompatibilityEngine.evaluate(profile, testFormula);

  assert.equal(report.isCompatible, false, "Kritik alerjen olduğu için uyumsuz olmalı");
  assert.equal(report.riskLevel, "HIGH");

  const criticalWarning = report.warnings.find(w => w.type === "PERSONAL_ALLERGEN");
  assert.ok(criticalWarning, "Şahsi alerjen uyarısı üretilmiş olmalı");
  assert.equal(criticalWarning.severity, "CRITICAL");

  const eczemaWarning = report.warnings.find(w => w.type === "BARRIER_STRIPPING_RISK");
  assert.ok(eczemaWarning, "Egzama uyarısı üretilmiş olmalı");

  const fungalWarning = report.warnings.find(w => w.type === "FUNGAL_ACNE_TRIGGER");
  assert.ok(fungalWarning, "Mantar aknesi uyarısı üretilmiş olmalı");
});

// 2. Mock Repository ile AuthService Testi (Bcrypt & JWT Güvenliği)
class MockUserRepository extends IUserRepository {
  constructor() {
    super();
    this.users = new Map();
  }

  async findByEmail(email) {
    return this.users.get(email.toLowerCase()) || null;
  }

  async findById(id) {
    for (const u of this.users.values()) {
      if (u.id === id) return u;
    }
    return null;
  }

  async save(user) {
    user.id = user.id || "mock-user-1";
    this.users.set(user.email.toLowerCase(), user);
    return user.id;
  }

  async updatePoints(userId, delta) {
    const user = await this.findById(userId);
    if (user) user.addPoints(delta);
  }
}

test("Personalization: AuthService parola güvenliği (Bcrypt) ve JWT üretimini sağlamalı", async () => {
  const mockRepo = new MockUserRepository();
  const authService = new AuthService(mockRepo);

  // Kayıt olma
  const regResult = await authService.register({
    email: "test@inciengine.com",
    password: "securePassword123",
    role: "user"
  });

  assert.equal(regResult.email, "test@inciengine.com");

  // Veritabanındaki parolanın düz metin DEĞİL, bcrypt hash olduğunu doğrula
  const savedUser = await mockRepo.findByEmail("test@inciengine.com");
  assert.notEqual(savedUser.passwordHash, "securePassword123");
  assert.ok(savedUser.passwordHash.startsWith("$2a$") || savedUser.passwordHash.startsWith("$2b$"));

  // Başarılı giriş
  const loginResult = await authService.login({
    email: "test@inciengine.com",
    password: "securePassword123"
  });

  assert.ok(loginResult.token, "JWT token üretilmiş olmalı");
  assert.equal(loginResult.user.email, "test@inciengine.com");

  // Hatalı parola kontrolü
  await assert.rejects(
    () => authService.login({ email: "test@inciengine.com", password: "wrongPassword" }),
    /Geçersiz e-posta veya parola/
  );
});

// 3. HTTP Entegrasyon Testleri
test("Personalization: POST /api/v1/profile/check-compatibility serbest içerik için uyumluluk raporu dönmeli", async () => {
  const server = app.listen(3092);
  try {
    const res = await fetch("http://localhost:3092/api/v1/profile/check-compatibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawIngredientsText: "Aqua, Glycerin, Sodium Hyaluronate",
        inlineProfile: {
          skinType: "dry",
          conditions: []
        }
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.evaluation.isCompatible, true);
    assert.equal(body.data.evaluation.riskLevel, "LOW");
  } finally {
    server.close();
  }
});

test("Personalization: GET /api/v1/profile/skin yetkisiz istekte 401 UNAUTHORIZED dönmeli", async () => {
  const server = app.listen(3091);
  try {
    const res = await fetch("http://localhost:3091/api/v1/profile/skin");
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "UNAUTHORIZED");
  } finally {
    server.close();
  }
});
