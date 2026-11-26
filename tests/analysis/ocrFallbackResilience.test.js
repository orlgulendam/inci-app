// tests/analysis/ocrFallbackResilience.test.js - Vision OCR Yedekleme ve Dayanıklılık Testleri
// Odak: Vision sağlayıcısı hata döndürdüğünde, zaman aşımına uğradığında, boş ya da bozuk
// yanıt verdiğinde servisin çökmemesi; sağlayıcılar arası yedeklemenin (Gemini <-> Groq)
// devreye girmesi ve başarısız sonucun önbelleğe yazılmaması.
//
// ÖNEMLİ: Hiçbir test gerçek ağ isteği atmaz. global.fetch her senaryoda sahtelenir ve
// servise her zaman açık anahtar/model verilir; ortam değişkenlerine bağlı davranış yoktur.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const GeminiVisionOcrService = require("../../src/modules/analysis/infrastructure/ocr/GeminiVisionOcrService");
const initializeAnalysisModule = require("../../src/modules/analysis");
const config = require("../../src/core/config/env");

const FAKE_GEMINI_KEY = "test-gemini-key-0000000000";
const FAKE_GROQ_KEY = "test-groq-key-0000000000";
const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "test-vision-model";

// Vision önbelleği modül düzeyinde paylaşıldığı için her senaryo kendi tekil görselini kullanır.
let payloadCounter = 0;
function uniqueImage() {
  payloadCounter += 1;
  return `OCRFALLBACKPAYLOAD${payloadCounter}${"A".repeat(48)}`;
}

const isGeminiUrl = (url) => String(url).includes("generativelanguage.googleapis.com");

function geminiOk(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
  };
}

function groqOk(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] })
  };
}

const httpError = (status) => ({ ok: false, status, text: async () => `provider error ${status}` });

// Sağlayıcı sırası config.ai.provider'a bağlı olduğundan test içinde açıkça sabitlenir.
function withProvider(t, provider) {
  const previous = config.ai.provider;
  config.ai.provider = provider;
  t.after(() => {
    config.ai.provider = previous;
  });
}

function geminiOnlyService() {
  return new GeminiVisionOcrService(FAKE_GEMINI_KEY, GEMINI_MODEL, "", "");
}

function dualProviderService() {
  return new GeminiVisionOcrService(FAKE_GEMINI_KEY, GEMINI_MODEL, FAKE_GROQ_KEY, GROQ_MODEL);
}

function assertDegraded(result) {
  assert.equal(result.ingredientsText, "", "okunamayan görselde içerik metni boş olmalı");
  assert.equal(result.confidence, "LOW");
  assert.equal(result.isFrontCover, true);
  assert.equal(result.detectedBrand, null);
  assert.equal(result.detectedProductName, null);
  assert.ok(result.error, "kullanıcıya gösterilecek hata mesajı bulunmalı");
  assert.match(result.error, /tekrar çekiniz/, "mesaj kullanıcıyı yeniden denemeye yönlendirmeli");
}

describe("OCR Dayanıklılığı: Sağlayıcı Hataları", () => {
  test("Vision sağlayıcısı HTTP 500 döndüğünde çökmeyip bozulmuş sonuç dönmeli", async (t) => {
    t.mock.method(global, "fetch", async () => httpError(500));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Yetkilendirme hatasında (401) da uygulama hata fırlatmamalı", async (t) => {
    t.mock.method(global, "fetch", async () => httpError(401));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Kota aşımında (429) bozulmuş sonuç dönmeli", async (t) => {
    t.mock.method(global, "fetch", async () => httpError(429));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Ağ isteği zaman aşımına uğradığında istek yutulup bozulmuş sonuç dönmeli", async (t) => {
    t.mock.method(global, "fetch", async () => {
      const timeout = new Error("The operation was aborted due to timeout");
      timeout.name = "TimeoutError";
      throw timeout;
    });

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Bağlantı sıfırlandığında (ECONNRESET) servis çökmemeli", async (t) => {
    t.mock.method(global, "fetch", async () => {
      const reset = new Error("socket hang up");
      reset.code = "ECONNRESET";
      throw reset;
    });

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });
});

describe("OCR Dayanıklılığı: Boş ve Bozuk Yanıtlar", () => {
  test("Sağlayıcı 200 dönüp boş aday listesi verdiğinde bozulmuş sonuç dönmeli", async (t) => {
    t.mock.method(global, "fetch", async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Yanıt gövdesi tamamen boş olduğunda bozulmuş sonuç dönmeli", async (t) => {
    t.mock.method(global, "fetch", async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Model JSON olmayan metin döndürdüğünde ayrıştırma hatası yutulmalı", async (t) => {
    t.mock.method(global, "fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "Bu bir JSON degil {{{" }] } }] })
    }));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Yanıtın gövdesi okunamadığında (json() hata atar) servis çökmemeli", async (t) => {
    t.mock.method(global, "fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected end of JSON input");
      }
    }));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Sağlayıcı içeriksiz ama geçerli JSON döndüğünde ön yüz kabul edilmeli", async (t) => {
    t.mock.method(global, "fetch", async () => geminiOk({
      ingredientsText: "",
      detectedBrand: "Testmarka",
      detectedProductName: "Test Serum",
      confidence: "MEDIUM"
    }));

    const result = await geminiOnlyService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.equal(result.ingredientsText, "");
    assert.equal(result.isFrontCover, true, "içerik listesi yoksa ön yüz olarak işaretlenmeli");
    assert.equal(result.detectedBrand, "Testmarka");
    assert.equal(result.error, undefined, "marka okunabildiğinde hata mesajı eklenmemeli");
  });
});

describe("OCR Dayanıklılığı: Sağlayıcılar Arası Yedekleme", () => {
  test("Gemini başarısız olduğunda Groq yedeği devreye girip içeriği okumalı", async (t) => {
    withProvider(t, "gemini");
    const requested = [];
    t.mock.method(global, "fetch", async (url) => {
      requested.push(isGeminiUrl(url) ? "gemini" : "groq");
      if (isGeminiUrl(url)) return httpError(503);
      return groqOk({
        ingredientsText: "Aqua, Glycerin, Panthenol",
        detectedBrand: "GroqMarka",
        isFrontCover: false,
        confidence: "HIGH"
      });
    });

    const result = await dualProviderService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.deepEqual(requested, ["gemini", "groq"], "önce Gemini denenmeli, sonra Groq yedeği");
    assert.equal(result.ingredientsText, "Aqua, Glycerin, Panthenol");
    assert.equal(result.detectedBrand, "GroqMarka");
    assert.equal(result.confidence, "HIGH");
    assert.equal(result.error, undefined, "yedek başarılıysa hata dönmemeli");
  });

  test("Groq birincil sağlayıcıyken başarısız olursa Gemini kullanılmalı", async (t) => {
    withProvider(t, "groq");
    const requested = [];
    t.mock.method(global, "fetch", async (url) => {
      requested.push(isGeminiUrl(url) ? "gemini" : "groq");
      if (isGeminiUrl(url)) return geminiOk({ ingredientsText: "Aqua, Niacinamide", confidence: "MEDIUM" });
      return httpError(429);
    });

    const result = await dualProviderService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.equal(requested[0], "groq", "yapılandırılmış birincil sağlayıcı önce denenmeli");
    assert.ok(requested.includes("gemini"), "birincil başarısız olunca Gemini denenmeli");
    assert.equal(result.ingredientsText, "Aqua, Niacinamide");
  });

  test("Her iki sağlayıcı da başarısız olduğunda bozulmuş sonuç dönmeli, istisna sızmamalı", async (t) => {
    withProvider(t, "gemini");
    t.mock.method(global, "fetch", async () => httpError(500));

    const result = await dualProviderService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assertDegraded(result);
  });

  test("Hiçbir sağlayıcı anahtarı yoksa kural tabanlı yerel simülasyon devreye girmeli", async (t) => {
    t.mock.method(global, "fetch", async () => {
      throw new Error("Anahtar yokken ağa çıkılmamalı");
    });

    const service = new GeminiVisionOcrService("", GEMINI_MODEL, "", "");
    const result = await service.extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.equal(result.isSimulated, true);
    assert.ok(result.ingredientsText.length > 0, "yerel yedek boş içerik dönmemeli");
    assert.equal(global.fetch.mock.callCount(), 0, "simülasyon modunda hiç ağ isteği yapılmamalı");
  });

  test("Groq anahtarı olsa da vision modeli tanımsızsa o sağlayıcı kullanılmamalı", async (t) => {
    withProvider(t, "groq");
    const requested = [];
    t.mock.method(global, "fetch", async (url) => {
      requested.push(isGeminiUrl(url) ? "gemini" : "groq");
      return geminiOk({ ingredientsText: "Aqua, Glycerin", confidence: "HIGH" });
    });

    const service = new GeminiVisionOcrService(FAKE_GEMINI_KEY, GEMINI_MODEL, FAKE_GROQ_KEY, "");
    const result = await service.extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.deepEqual(requested, ["gemini"], "modeli tanımsız Groq'a boşa istek atılmamalı");
    assert.equal(result.ingredientsText, "Aqua, Glycerin");
  });
});

describe("OCR Dayanıklılığı: Önbellek Davranışı", () => {
  test("Başarısız okuma önbelleğe yazılmamalı, yeniden deneme başarılı olabilmeli", async (t) => {
    const image = uniqueImage();

    const failing = t.mock.method(global, "fetch", async () => httpError(500));
    const firstResult = await geminiOnlyService().extractIngredientsFromImage({ base64Data: image });
    assertDegraded(firstResult);
    assert.equal(failing.mock.callCount(), 1);
    failing.mock.restore();

    const succeeding = t.mock.method(global, "fetch", async () => geminiOk({
      ingredientsText: "Aqua, Glycerin",
      confidence: "HIGH"
    }));
    const retryResult = await geminiOnlyService().extractIngredientsFromImage({ base64Data: image });

    assert.equal(retryResult.ingredientsText, "Aqua, Glycerin", "yeniden deneme bozulmuş önbellekle zehirlenmemeli");
    assert.equal(succeeding.mock.callCount(), 1, "yeniden deneme gerçekten sağlayıcıya gitmeli");
  });

  test("Başarılı okuma önbellekten dönmeli ve ikinci kez ağa çıkmamalı", async (t) => {
    const image = uniqueImage();

    const first = t.mock.method(global, "fetch", async () => geminiOk({
      ingredientsText: "Aqua, Panthenol",
      confidence: "HIGH"
    }));
    await geminiOnlyService().extractIngredientsFromImage({ base64Data: image });
    assert.equal(first.mock.callCount(), 1);
    first.mock.restore();

    const shouldNotRun = t.mock.method(global, "fetch", async () => {
      throw new Error("Önbellekten dönmesi gerekirken ağa çıkıldı");
    });
    const cached = await geminiOnlyService().extractIngredientsFromImage({ base64Data: image });

    assert.equal(cached.isCached, true);
    assert.equal(cached.ingredientsText, "Aqua, Panthenol");
    assert.equal(shouldNotRun.mock.callCount(), 0);
  });
});

describe("OCR Dayanıklılığı: Girdi Doğrulama", () => {
  test("Boş base64 verisinde anlamlı hata fırlatılmalı", async () => {
    await assert.rejects(
      () => geminiOnlyService().extractIngredientsFromImage({ base64Data: "" }),
      { message: "Görsel verisi (base64) boş olamaz." }
    );
  });

  test("data: URI öneki ayıklanıp MIME tipi istekte kullanılmalı", async (t) => {
    const bodies = [];
    t.mock.method(global, "fetch", async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return geminiOk({ ingredientsText: "Aqua", confidence: "HIGH" });
    });

    const raw = uniqueImage();
    await geminiOnlyService().extractIngredientsFromImage({ base64Data: `data:image/png;base64,${raw}` });

    const inlineData = bodies[0].contents[0].parts[1].inlineData;
    assert.equal(inlineData.mimeType, "image/png", "MIME tipi data URI'den okunmalı");
    assert.equal(inlineData.data, raw, "base64 gövdesi önekinden ayrılmalı");
  });
});

describe("OCR Dayanıklılığı: Controller Katmanı", () => {
  function callController(ocrService, body) {
    const { controller } = initializeAnalysisModule({
      repository: { findByInciName: async () => null, search: async () => [], bulkFindByInciNames: async () => new Map() },
      ocrService
    });

    return new Promise((resolve, reject) => {
      const res = {
        statusCode: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          resolve({ statusCode: this.statusCode, body: payload });
          return this;
        }
      };
      controller.extractOcrText({ body }, res, reject);
    });
  }

  test("OCR bozulmuş sonuç dönse de uç nokta 200 ve analysis: null vermeli", async () => {
    const degradedOcr = {
      extractIngredientsFromImage: async () => ({
        ingredientsText: "",
        detectedProductName: null,
        detectedBrand: null,
        isFrontCover: true,
        confidence: "LOW",
        error: "Görselden metin veya marka okunamadı."
      })
    };

    const res = await callController(degradedOcr, { image: uniqueImage(), autoAnalyze: true });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.analysis, null, "metin okunamadıysa analiz denenmemeli");
    assert.ok(res.body.data.error, "hata mesajı istemciye aktarılmalı");
  });

  test("OCR metni çok kısa olduğunda analiz atlanmalı, istek yine başarılı olmalı", async () => {
    const shortTextOcr = {
      extractIngredientsFromImage: async () => ({ ingredientsText: "Aq", confidence: "LOW", isFrontCover: false })
    };

    const res = await callController(shortTextOcr, { image: uniqueImage(), autoAnalyze: true });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.analysis, null);
  });

  test("OCR başarılı olduğunda autoAnalyze analiz özetini eklemeli", async () => {
    const workingOcr = {
      extractIngredientsFromImage: async () => ({
        ingredientsText: "Aqua, Glycerin, Niacinamide",
        detectedBrand: "Testmarka",
        isFrontCover: false,
        confidence: "HIGH"
      })
    };

    const res = await callController(workingOcr, { image: uniqueImage(), autoAnalyze: true });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.data.analysis, "autoAnalyze gönderildiğinde analiz üretilmeli");
    assert.equal(res.body.data.analysis.summary.totalIngredients, 3);
    assert.equal(typeof res.body.data.analysis.summary.score, "number");
  });

  test("autoAnalyze gönderilmediğinde analiz hiç çalıştırılmamalı", async () => {
    // Sözlüğe gelen sorgular sayılır: analiz çalışsaydı bileşenler için arama yapılırdı.
    const lookups = [];
    const { controller } = initializeAnalysisModule({
      repository: {
        findByInciName: async (name) => {
          lookups.push(name);
          return null;
        },
        search: async () => [],
        bulkFindByInciNames: async () => new Map()
      },
      ocrService: {
        extractIngredientsFromImage: async () => ({
          ingredientsText: "Aqua, Glycerin",
          confidence: "HIGH",
          isFrontCover: false
        })
      }
    });

    const res = await new Promise((resolve, reject) => {
      const response = {
        statusCode: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          resolve({ statusCode: this.statusCode, body: payload });
          return this;
        }
      };
      controller.extractOcrText({ body: { image: uniqueImage() } }, response, reject);
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.analysis, null);
    assert.equal(res.body.data.ingredientsText, "Aqua, Glycerin", "OCR metni yine dönmeli");
    assert.deepEqual(lookups, [], "autoAnalyze yokken sözlüğe hiç sorgu gitmemeli");
  });

  test("OCR servisi istisna fırlatırsa hata orta katmana devredilmeli", async () => {
    const throwingOcr = {
      extractIngredientsFromImage: async () => {
        throw new Error("Vision sağlayıcısı tamamen erişilemez");
      }
    };

    const { controller } = initializeAnalysisModule({
      repository: { findByInciName: async () => null, search: async () => [], bulkFindByInciNames: async () => new Map() },
      ocrService: throwingOcr
    });

    const forwarded = await new Promise((resolve) => {
      const res = { status: () => res, json: () => res };
      controller.extractOcrText({ body: { image: uniqueImage() } }, res, resolve);
    });

    assert.ok(forwarded instanceof Error, "istisna next() ile hata orta katmanına aktarılmalı");
    assert.match(forwarded.message, /erişilemez/);
  });
});

describe("OCR Dayanıklılığı: Düzeltilen Hatalar (Regresyon)", () => {
  test("Aynı istekte başarısız olan sağlayıcı ikinci kez denenmemeli", async (t) => {
    // provider=groq iken Groq düşüp Gemini de düşerse yedek blok eskiden Groq'u
    // tekrar çağırıyordu: tek istek için üç API çağrısı.
    withProvider(t, "groq");
    const requested = [];
    t.mock.method(global, "fetch", async (url) => {
      requested.push(isGeminiUrl(url) ? "gemini" : "groq");
      return httpError(500);
    });

    const result = await dualProviderService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.deepEqual(requested, ["groq", "gemini"], "her sağlayıcı en çok bir kez denenmeli");
    assert.equal(requested.filter((p) => p === "groq").length, 1, "Groq'a boşa ikinci çağrı yapılmamalı");
    assertDegraded(result);
  });

  test("Groq henüz denenmediyse Gemini hatasından sonra yedek olarak çalışmalı", async (t) => {
    // Tekrar engelinin gerçek yedeklemeyi kapatmadığı doğrulanır.
    withProvider(t, "gemini");
    const requested = [];
    t.mock.method(global, "fetch", async (url) => {
      requested.push(isGeminiUrl(url) ? "gemini" : "groq");
      if (isGeminiUrl(url)) return httpError(500);
      return groqOk({ ingredientsText: "Aqua, Glycerin", confidence: "HIGH" });
    });

    const result = await dualProviderService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.deepEqual(requested, ["gemini", "groq"]);
    assert.equal(result.ingredientsText, "Aqua, Glycerin");
  });

  test("Her iki sağlayıcı da düştüğünde toplam istek sayısı ikiyi aşmamalı", async (t) => {
    withProvider(t, "gemini");
    const fetchMock = t.mock.method(global, "fetch", async () => httpError(503));

    await dualProviderService().extractIngredientsFromImage({ base64Data: uniqueImage() });

    assert.equal(fetchMock.mock.callCount(), 2, "sağlayıcı sayısı kadar istek atılmalı");
  });
});
