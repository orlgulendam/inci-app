// tests/personalization/chatGuestProfile.test.js
// Gerileme testi: profili olmayan kullaniciya uydurma cilt profili atfedilmemeli.
const test = require("node:test");
const assert = require("node:assert/strict");

const ChatService = require("../../src/modules/personalization/application/services/ChatService");
const MockFallbackAiProvider = require("../../src/modules/personalization/infrastructure/ai/MockFallbackAiProvider");

function createService(onProfile, { user = null } = {}) {
  const yakalayanSaglayici = {
    async generateChatResponse(payload) {
      onProfile(payload.safeProfile);
      return { reply: "test", suggestions: [], provider: "test" };
    }
  };

  return new ChatService({
    userRepository: { async findById() { return user; } },
    primaryAiProvider: yakalayanSaglayici,
    fallbackAiProvider: yakalayanSaglayici
  });
}

test("Misafir istekte AI'ya uydurma cilt profili gonderilmemeli", async () => {
  let gonderilen = null;
  const service = createService((p) => { gonderilen = p; });

  await service.askAssistant({ userId: null, message: "Niacinamide nedir?" });

  assert.strictEqual(gonderilen.hasProfile, false, "hasProfile false olmali");
  assert.strictEqual(gonderilen.skinType, null, "Cilt tipi uydurulmamali (eskiden 'normal' gonderiliyordu)");
  assert.deepStrictEqual(gonderilen.allergicIngredients, [], "Alerjen listesi bos olmali");
});

test("Profili olan kullanicida hasProfile true ve gercek veri gonderilmeli", async () => {
  let gonderilen = null;
  const user = {
    id: "u1",
    skinProfile: {
      skinType: "dry",
      conditions: ["eczema"],
      allergicIngredients: ["PARABENS"],
      targetedBenefits: ["nemlendirme"],
      dermatologistNotes: [{ note: "AI'ya gitmemeli" }]
    }
  };
  const service = createService((p) => { gonderilen = p; }, { user });

  await service.askAssistant({ userId: "u1", message: "Bu urun bana uygun mu?" });

  assert.strictEqual(gonderilen.hasProfile, true);
  assert.strictEqual(gonderilen.skinType, "dry");
  assert.ok(gonderilen.allergicIngredients.includes("PARABENS"));
  assert.strictEqual(gonderilen.dermatologistNotes, undefined, "Dermatolog notu AI'ya gonderilmemeli (KVKK)");
});

test("Sistem komutu, profil yokken varsayim yapmayi acikca yasaklamali", () => {
  const GroqChatProvider = require("../../src/modules/personalization/infrastructure/ai/GroqChatProvider");
  const provider = new GroqChatProvider({ apiKey: "test", model: "test" });

  const profilsiz = provider.buildSystemInstruction({
    safeProfile: { hasProfile: false, skinType: null, conditions: [], allergicIngredients: [], targetedBenefits: [] },
    ingredients: []
  });

  assert.match(profilsiz, /KAYITLI CİLT PROFİLİ YOK/, "Profil yokluğu komutta belirtilmeli");
  assert.match(profilsiz, /varsayımda bulunma/i, "Varsayım yapmak açıkça yasaklanmalı");
  assert.ok(!/Cilt Tipi: Normal/.test(profilsiz), "Uydurma 'Normal' cilt tipi komuta girmemeli");

  const profilli = provider.buildSystemInstruction({
    safeProfile: { hasProfile: true, skinType: "dry", conditions: [], allergicIngredients: [], targetedBenefits: [] },
    ingredients: []
  });
  assert.match(profilli, /Cilt Tipi: dry/, "Gerçek profil komuta girmeli");
});

test("Yedek (mock) saglayici profil yokken cilt tipi uydurmamali", async () => {
  const provider = new MockFallbackAiProvider();
  const res = await provider.generateChatResponse({
    message: "Bu urun nasil?",
    safeProfile: { hasProfile: false, skinType: null, conditions: [], allergicIngredients: [], targetedBenefits: [] },
    ingredients: ["Aqua", "Glycerin"]
  });

  assert.ok(!/null/.test(res.reply), "Yanitta 'null' cilt tipi gorunmemeli");
  assert.ok(!/Cilt profiliniz \(/.test(res.reply), "Olmayan profile atif yapilmamali");
});
