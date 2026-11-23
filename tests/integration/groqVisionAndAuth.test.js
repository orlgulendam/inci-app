// tests/integration/groqVisionAndAuth.test.js
// Groq Vision (qwen) ayrıştırma dayanıklılığı, GroqChatProvider sözleşmesi,
// verifyEmail JWT üretimi ve OpenBeautyFacts adaptörü.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const GeminiVisionOcrService = require("../../src/modules/analysis/infrastructure/ocr/GeminiVisionOcrService");
const GroqChatProvider = require("../../src/modules/personalization/infrastructure/ai/GroqChatProvider");
const OpenBeautyFactsAdapter = require("../../src/modules/catalog/infrastructure/adapters/OpenBeautyFactsAdapter");

const TINY_IMAGE = "data:image/jpeg;base64,R0xPUlFWSVNJT05URVNUSU1BR0U=";

function mockFetchOnce(t, handler) {
  t.mock.method(global, "fetch", handler);
}

describe("Groq Vision (qwen/qwen3.8-27b) OCR", () => {
  test("Groq yanıtını doğru ayrıştırmalı ve alanları eşlemeli", async (t) => {
    let capturedBody = null;
    mockFetchOnce(t, async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                ingredientsText: "Aqua, Glycerin, Niacinamide",
                detectedProductName: "Test Serum",
                detectedBrand: "Test Marka",
                detectedCategory: "Serum",
                isFrontCover: false,
                confidence: "HIGH"
              })
            }
          }]
        })
      };
    });

    const service = new GeminiVisionOcrService("", undefined, "gsk_test_key_1234567890", "qwen/qwen3.8-27b");
    const result = await service.extractIngredientsFromImage({ base64Data: TINY_IMAGE });

    assert.equal(result.detectedBrand, "Test Marka");
    assert.equal(result.detectedProductName, "Test Serum");
    assert.equal(result.confidence, "HIGH");
    assert.ok(result.ingredientsText.includes("Niacinamide"));

    // Yapılandırılan model gerçekten isteğe konmalı
    assert.equal(capturedBody.model, "qwen/qwen3.8-27b");
    assert.equal(capturedBody.response_format.type, "json_object");
  });

  test("Groq başarısız olduğunda çökmeyip güvenli boş sonuç dönmeli", async (t) => {
    mockFetchOnce(t, async () => ({
      ok: false,
      status: 503,
      text: async () => "service unavailable"
    }));

    const service = new GeminiVisionOcrService("", undefined, "gsk_test_key_1234567890", "qwen/qwen3.8-27b");
    const result = await service.extractIngredientsFromImage({ base64Data: TINY_IMAGE + "X" });

    assert.equal(result.ingredientsText, "");
    assert.equal(result.confidence, "LOW");
    assert.ok(result.error, "kullanıcıya gösterilecek hata mesajı dolu olmalı");
  });

  test("Hiçbir sağlayıcı yapılandırılmamışsa simülasyon moduna düşmeli", async () => {
    const service = new GeminiVisionOcrService("", undefined, "", "");
    const result = await service.extractIngredientsFromImage({ base64Data: TINY_IMAGE + "SIM" });

    assert.equal(result.isSimulated, true);
    assert.ok(result.ingredientsText.includes("Aqua"));
  });
});

describe("GroqChatProvider", () => {
  test("JSON sözleşmesine uygun yanıt üretmeli", async (t) => {
    let captured = null;
    mockFetchOnce(t, async (url, init) => {
      captured = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                reply: "Bu ürün cildiniz için uygun değil.",
                suggestions: ["Parfümsüz alternatif ister misiniz?"],
                compatibilityVerdict: "UYGUN_DEGIL"
              })
            }
          }]
        })
      };
    });

    const provider = new GroqChatProvider("gsk_test_key_1234567890", "openai/gpt-oss-120b");
    const res = await provider.generateChatResponse({
      message: "Bu ürün bana uygun mu?",
      safeProfile: { skinType: "sensitive", allergicIngredients: ["LINALOOL"] },
      ingredients: ["Aqua", "Linalool"]
    });

    assert.equal(res.compatibilityVerdict, "UYGUN_DEGIL");
    assert.ok(res.reply.length > 0);
    assert.equal(res.provider, "groq:openai/gpt-oss-120b");
    assert.equal(captured.model, "openai/gpt-oss-120b");
  });

  test("429 kota aşımında RATE_LIMIT_EXCEEDED fırlatmalı (yedek sağlayıcıya geçiş sinyali)", async (t) => {
    mockFetchOnce(t, async () => ({ ok: false, status: 429, text: async () => "rate limited" }));

    const provider = new GroqChatProvider("gsk_test_key_1234567890");
    await assert.rejects(
      () => provider.generateChatResponse({ message: "selam", safeProfile: {}, ingredients: [] }),
      (err) => err.code === "RATE_LIMIT_EXCEEDED" && err.status === 429
    );
  });

  test("Anahtar yoksa AI_CONFIG_ERROR fırlatmalı", async () => {
    const provider = new GroqChatProvider("");
    await assert.rejects(
      () => provider.generateChatResponse({ message: "selam", safeProfile: {}, ingredients: [] }),
      (err) => err.code === "AI_CONFIG_ERROR"
    );
  });
});

describe("AuthService.verifyEmail oturum üretimi", () => {
  test("Doğrulama sonrası JWT ve kullanıcı nesnesi dönmeli", async () => {
    const AuthService = require("../../src/modules/personalization/application/services/AuthService");

    const user = {
      id: "user-1",
      email: "test@example.com",
      firstName: "Test",
      lastName: "Kullanici",
      role: "user",
      isEmailVerified: false,
      points: 0,
      verifyEmail(token) { this.isEmailVerified = true; }
    };

    const userRepository = {
      findByVerificationToken: async () => user,
      save: async () => user
    };

    const service = new AuthService(userRepository);
    const result = await service.verifyEmail("dogrulama-token");

    assert.equal(result.isEmailVerified, true);
    assert.ok(result.token, "verifyEmail JWT dönmeli; aksi halde RouteGuard giriş ekranına atıyor");
    assert.equal(result.user.email, "test@example.com");
    assert.equal(result.user.isEmailVerified, true);
  });
});

describe("OpenBeautyFactsAdapter", () => {
  test("Geçerli yanıtı katalog şemasına eşlemeli", async () => {
    const adapter = new OpenBeautyFactsAdapter({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 1,
          product: {
            product_name: "Hydrating Cleanser",
            brands: "CeraVe",
            ingredients_text: "Aqua, Glycerin, Ceramide NP",
            image_front_url: "https://example.test/x.jpg"
          }
        })
      })
    });

    const res = await adapter.fetchByBarcode("3337875597180");
    assert.equal(res.productName, "Hydrating Cleanser");
    assert.equal(res.brandName, "CeraVe");
    assert.ok(res.rawIngredientsText.includes("Ceramide NP"));
    assert.equal(res.isVerified, false);
  });

  test("Ürün bulunamazsa null dönmeli", async () => {
    const adapter = new OpenBeautyFactsAdapter({
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: 0 }) })
    });
    assert.equal(await adapter.fetchByBarcode("0000000000000"), null);
  });

  test("Ağ hatasında çökmeyip null dönmeli (fail-soft)", async () => {
    const adapter = new OpenBeautyFactsAdapter({
      fetchImpl: async () => { throw new Error("network down"); }
    });
    assert.equal(await adapter.fetchByBarcode("3337875597180"), null);
  });

  test("Geçersiz barkod formatında ağa hiç çıkmamalı", async () => {
    let called = false;
    const adapter = new OpenBeautyFactsAdapter({
      fetchImpl: async () => { called = true; return { ok: true, json: async () => ({}) }; }
    });
    assert.equal(await adapter.fetchByBarcode("abc"), null);
    assert.equal(called, false);
  });
});
