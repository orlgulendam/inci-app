// src/modules/personalization/infrastructure/ai/GroqChatProvider.js - Groq Sohbet Stratejisi (Strategy Pattern)
// Gerekçe: Harici AI çağrılarını izole eder ve yapılandırılmış JSON çıktısı üretir.
// Groq, OpenAI uyumlu /chat/completions arayüzü sunar ve `json_object` yanıt formatını destekler.
const IAiProvider = require("./IAiProvider");
const logger = require("../../../../core/logging/logger");

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

class GroqChatProvider extends IAiProvider {
  constructor(apiKey, model = "openai/gpt-oss-120b") {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  buildSystemInstruction({ safeProfile, ingredients }) {
    const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0;
    return `Sen uzman bir kozmetik içerik (INCI), makyaj ve dermokozmetik danışmanısın (skinbyinci yapay zeka asistanı).
Kullanıcının cilt profili:
- Cilt Tipi: ${safeProfile.skinType || "Normal"}
- Cilt Durumları/Hassasiyetleri: ${safeProfile.conditions?.join(", ") || "Yok"}
- Alerjen Olduğu İçerikler: ${safeProfile.allergicIngredients?.join(", ") || "Yok"}
- Hedeflediği Cilt Etkileri: ${safeProfile.targetedBenefits?.join(", ") || "Genel bakım"}
${hasIngredients ? `İncelenen Ürün İçerik Listesi (INCI): ${ingredients.join(", ")}` : "Şu an belirli bir ürün incelenmiyor; kullanıcı doğrudan sohbet ediyor veya genel bir soru soruyor."}

KURALLAR:
1. Kullanıcı belirli bir ürün içeriği göndermediyse, kesinlikle 'ürün içeriklerini değerlendirdik' deme! Kullanıcıyı dinle, kibar ve esprili bir şekilde yanıtla, hangi ürünü veya sorunu danışmak istediğini sor.
2. Ürün içeriği (INCI) varsa, cilt tipine ve alerjenlerine göre ürünün uygunluğunu, komedojenik riskini ve bariyer etkisini açıkla.
3. Asla tıbbi teşhis koyma.
4. Türkçe yanıt ver.
5. Yanıtı SADECE aşağıdaki JSON formatında üret, başka hiçbir metin ekleme:
{
  "reply": "Kullanıcıya vereceğin samimi, bilimsel ve net açıklama",
  "suggestions": ["Önerilen takip sorusu 1", "Önerilen takip sorusu 2"],
  "compatibilityVerdict": "UYGUN" | "DIKKAT" | "UYGUN_DEGIL" | "BILGI"
}`;
  }

  async generateChatResponse({ message, safeProfile, ingredients = [], history = [] }) {
    if (!this.apiKey) {
      const err = new Error("GROQ_API_KEY konfigüre edilmemiş.");
      err.code = "AI_CONFIG_ERROR";
      throw err;
    }

    const messages = [{ role: "system", content: this.buildSystemInstruction({ safeProfile, ingredients }) }];

    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        messages.push({
          role: item.role === "user" ? "user" : "assistant",
          content: item.text || item.message || ""
        });
      }
    }
    messages.push({ role: "user", content: message });

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.3
      })
    });

    // ChatService 429'u yedek sağlayıcıya geçiş sinyali olarak kullanır
    if (res.status === 429) {
      const err = new Error("Groq API kota sınırı aşıldı (429 Rate Limit).");
      err.code = "RATE_LIMIT_EXCEEDED";
      err.status = 429;
      throw err;
    }

    if (!res.ok) {
      const errorText = await res.text();
      const err = new Error(`Groq API hatası: ${res.status} - ${errorText}`);
      err.code = "AI_API_ERROR";
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error("Groq API boş yanıt döndü.");
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      logger.warn("Groq yanıtı JSON olarak ayrıştırılamadı.", { preview: String(rawText).slice(0, 200) });
      throw new Error("Geçersiz AI yanıt şeması.");
    }

    return {
      reply: parsed.reply,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      compatibilityVerdict: parsed.compatibilityVerdict || "BILGI",
      provider: `groq:${this.model}`
    };
  }
}

module.exports = GroqChatProvider;
