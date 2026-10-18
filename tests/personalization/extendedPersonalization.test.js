// tests/personalization/extendedPersonalization.test.js - Genişletilmiş Profil, Auth ve AI Testleri
const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../../src/modules/personalization/domain/entities/User");
const SkinProfile = require("../../src/modules/personalization/domain/value-objects/SkinProfile");
const AuthService = require("../../src/modules/personalization/application/services/AuthService");
const AiPrivacyGuard = require("../../src/modules/personalization/domain/services/AiPrivacyGuard");
const MockFallbackAiProvider = require("../../src/modules/personalization/infrastructure/ai/MockFallbackAiProvider");
const ChatService = require("../../src/modules/personalization/application/services/ChatService");

class MemoryUserRepository {
  constructor() {
    this.users = new Map();
    this.idCounter = 1;
  }
  async findById(id) {
    return this.users.get(String(id)) || null;
  }
  async findByEmail(email) {
    return Array.from(this.users.values()).find(u => u.email === email.toLowerCase().trim()) || null;
  }
  async findByVerificationToken(token) {
    return Array.from(this.users.values()).find(u => u.emailVerificationToken === token) || null;
  }
  async findByResetToken(token) {
    return Array.from(this.users.values()).find(u => u.isResetTokenValid(token)) || null;
  }
  async findAllUsers({ page = 1, limit = 20 } = {}) {
    const list = Array.from(this.users.values());
    return { items: list.slice((page - 1) * limit, page * limit), meta: { total: list.length, page, limit } };
  }
  async save(user) {
    if (!user.id) {
      user.id = String(this.idCounter++);
    }
    this.users.set(String(user.id), user);
    return user.id;
  }
}

test("AuthService: E-posta doğrulama akışı (Token üretimi, doğrulama, tekrar gönderme)", async () => {
  const repo = new MemoryUserRepository();
  const authService = new AuthService(repo);

  // 1. Kayıt Ol
  const regResult = await authService.register({
    email: "test@inci.app",
    password: "Password123!",
    firstName: "Gülendam",
    lastName: "Yılmaz"
  });

  assert.strictEqual(regResult.isEmailVerified, false);
  assert.ok(regResult.verificationToken, "Kayıtta doğrulama token'ı üretilmelidir.");

  // 2. Yanlış token ile doğrulama hatası
  await assert.rejects(
    async () => authService.verifyEmail("invalid_token_123"),
    /Geçersiz veya süresi dolmuş/
  );

  // 3. Doğru token ile doğrulama
  const verifyResult = await authService.verifyEmail(regResult.verificationToken);
  assert.strictEqual(verifyResult.isEmailVerified, true);

  const updatedUser = await repo.findByEmail("test@inci.app");
  assert.strictEqual(updatedUser.isEmailVerified, true);
  assert.strictEqual(updatedUser.emailVerificationToken, null);

  // 4. Doğrulanmış kullanıcı için tekrar gönderme (bilgi sızdırmadan yanıt döner)
  const resendResult = await authService.resendVerification("test@inci.app");
  assert.ok(resendResult.message.includes("Eğer hesabınız mevcut"));
});

test("AuthService: Şifremi unuttum ve şifre sıfırlama akışı", async () => {
  const repo = new MemoryUserRepository();
  const authService = new AuthService(repo);

  await authService.register({
    email: "reset@inci.app",
    password: "OldPassword123!"
  });

  // Şifre sıfırlama talebi
  const forgotResult = await authService.forgotPassword("reset@inci.app");
  assert.ok(forgotResult.resetToken, "Sıfırlama token'ı dönmeli.");

  // Yeni şifre belirle
  const resetResult = await authService.resetPassword({
    token: forgotResult.resetToken,
    newPassword: "BrandNewPassword456!"
  });
  assert.ok(resetResult.message.includes("başarıyla"));

  // Eski şifre ile giriş yapılamamalı, yeni şifre ile yapılabilmeli
  await assert.rejects(
    async () => authService.login({ email: "reset@inci.app", password: "OldPassword123!" }),
    /Geçersiz e-posta veya parola/
  );

  const loginRes = await authService.login({ email: "reset@inci.app", password: "BrandNewPassword456!" });
  assert.ok(loginRes.token);
});

test("AiPrivacyGuard: KVKK koruması ad, soyad, e-posta ve doktor notlarını temizlemeli", () => {
  const fullProfile = {
    skinType: "kuru",
    conditions: ["hassasiyet"],
    allergicIngredients: ["Fragrance", "Parabens"],
    targetedBenefits: ["nemlendirme", "yatıştırıcı"],
    dermatologistNotes: "Hastanın cildinde rozasea teşhisi var, günde 2 kez krem verilsin.",
    routineMedications: ["Rozasea Kremi 1%"],
    frequentlyUsedProducts: ["Nemlendirici X"]
  };

  const safe = AiPrivacyGuard.sanitizeForAi(fullProfile);

  assert.strictEqual(safe.skinType, "kuru");
  assert.deepStrictEqual(safe.conditions, ["hassasiyet"]);
  assert.deepStrictEqual(safe.allergicIngredients, ["Fragrance", "Parabens"]);
  assert.deepStrictEqual(safe.targetedBenefits, ["nemlendirme", "yatıştırıcı"]);

  // Asla bulunmaması gereken KVKK/tıbbi alanlar
  assert.strictEqual(safe.dermatologistNotes, undefined);
  assert.strictEqual(safe.routineMedications, undefined);
  assert.strictEqual(safe.frequentlyUsedProducts, undefined);
  assert.strictEqual(safe.email, undefined);
});

test("ChatService: 429 Kota aşımında MockFallbackAiProvider devreye girmeli ve tıbbi uyarı dönmeli", async () => {
  const repo = new MemoryUserRepository();
  const mockUser = new User({
    id: "user1",
    email: "user@inci.app",
    passwordHash: "hash",
    skinProfile: new SkinProfile({
      skinType: "kuru",
      allergicIngredients: ["Alcohol Denat"]
    })
  });
  await repo.save(mockUser);

  // 429 simüle eden birincil sağlayıcı
  const failingPrimaryProvider = {
    generateChatResponse: async () => {
      const err = new Error("Rate limit exceeded");
      err.code = "RATE_LIMIT_EXCEEDED";
      err.status = 429;
      throw err;
    }
  };

  const fallbackProvider = new MockFallbackAiProvider();
  const chatService = new ChatService({
    userRepository: repo,
    primaryAiProvider: failingPrimaryProvider,
    fallbackAiProvider: fallbackProvider
  });

  const response = await chatService.askAssistant({
    userId: "user1",
    message: "Bu ürün benim için güvenli mi?",
    rawIngredients: ["Aqua", "Glycerin", "Alcohol Denat"]
  });

  assert.ok(response.reply.includes("yoğunluk"), "429 durumunda kullanıcıya yoğunluk bilgisi verilmeli.");
  assert.ok(response.reply.includes("Alcohol Denat"), "Alerjen içerik tespit edilmeli.");
  assert.strictEqual(response.compatibilityVerdict, "UYGUN_DEGIL");
  assert.strictEqual(response.disclaimer, "Bu bilgiler tıbbi tavsiye değildir, dermatoloğunuza danışın.");
});
