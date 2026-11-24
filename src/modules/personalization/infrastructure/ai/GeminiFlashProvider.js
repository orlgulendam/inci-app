// src/modules/personalization/infrastructure/ai/GeminiFlashProvider.js - Google Gemini Flash Stratejisi (Strategy Pattern)
// Gerekçe: Harici AI çağrılarını izole eder ve yapılandırılmış JSON çıktısı üretir.
const IAiProvider = require("./IAiProvider");
const logger = require("../../../../core/logging/logger");

class GeminiFlashProvider extends IAiProvider {
  constructor(apiKey, model = "gemini-2.5-flash") {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateChatResponse({ message, safeProfile, ingredients = [], history = [] }) {
    if (!this.apiKey) {
      const err = new Error("GEMINI_API_KEY konfigüre edilmemiş.");
      err.code = "AI_CONFIG_ERROR";
      throw err;
    }

    const hasIngredients = ingredients && ingredients.length > 0;
    const systemInstruction = `Sen uzman bir kozmetik içerik (INCI), makyaj ve dermokozmetik danışmanısın (skinbyinci yapay zeka asistanı).
Kullanıcının cilt profili:
- Cilt Tipi: ${safeProfile.skinType || "Normal"}
- Cilt Durumları/Hassasiyetleri: ${safeProfile.conditions?.join(", ") || "Yok"}
- Alerjen Olduğu İçerikler: ${safeProfile.allergicIngredients?.join(", ") || "Yok"}
- Hedeflediği Cilt Etkileri: ${safeProfile.targetedBenefits?.join(", ") || "Genel bakım"}
${hasIngredients ? `İncelenen Ürün İçerik Listesi (INCI): ${ingredients.join(", ")}` : "Şu an belirli bir ürün incelenmiyor; kullanıcı doğrudan sohbet ediyor veya genel bir soru soruyor."}

KURALLAR:
1. Kullanıcı belirli bir ürün içeriği göndermediyse (örneğin 'ben sana ürün vermedim ki' veya genel soru soruyorsa), kesinlikle 'ürün içeriklerini değerlendirdik' deme! Kullanıcıyı dinle, kibar ve esprili bir şekilde yanıtla, hangi ürünü veya sorunu danışmak istediğini sor.
2. Ürün içeriği (INCI) varsa, cilt tipine ve alerjenlerine göre ürünün uygunluğunu, komedojenik riskini ve bariyer etkisini açıkla.
3. Asla tıbbi teşhis koyma.
4. Yanıtı SADECE aşağıdaki JSON formatında üret:
{
  "reply": "Kullanıcıya vereceğin samimi, bilimsel ve net açıklama",
  "suggestions": ["Önerilen takip sorusu 1", "Önerilen takip sorusu 2"],
  "compatibilityVerdict": "UYGUN" | "DIKKAT" | "UYGUN_DEGIL" | "BILGI"
}`;

    const contents = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        contents.push({
          role: item.role === "user" ? "user" : "model",
          parts: [{ text: item.text || item.message || "" }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (res.status === 429) {
      const err = new Error("Gemini API kota sınırı aşıldı (429 Rate Limit).");
      err.code = "RATE_LIMIT_EXCEEDED";
      err.status = 429;
      throw err;
    }

    if (!res.ok) {
      const errorText = await res.text();
      const err = new Error(`Gemini API hatası: ${res.status} - ${errorText}`);
      err.code = "AI_API_ERROR";
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error("Gemini API boş yanıt döndü.");
    }

    const parsed = JSON.parse(candidate);
    return {
      reply: parsed.reply,
      suggestions: parsed.suggestions || [],
      compatibilityVerdict: parsed.compatibilityVerdict || "BILGI",
      provider: "gemini-flash"
    };
  }
}

module.exports = GeminiFlashProvider;
