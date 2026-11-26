// src/modules/analysis/infrastructure/ocr/GeminiVisionOcrService.js - Çok Modlu (Multimodal) Görsel OCR Servisi
// Gerekçe: Ambalaj üzerindeki kıvrımlı, küçük ve silik "Ingredients" metinlerini yapay zeka görüşüyle (Vision) kusursuz ayıklamak için.
const crypto = require("crypto");
const config = require("../../../../core/config/env");
const logger = require("../../../../core/logging/logger");

// İstemci ve sunucu maliyetini sıfıra indirmek için bellek içi görsel önbelleği (In-Memory LRU Cache)
const visionCache = new Map();
const MAX_CACHE_SIZE = 500;

class GeminiVisionOcrService {
  constructor(
    apiKey = config.ai.geminiApiKey,
    model = config.ai.geminiModel || "gemini-2.5-flash",
    groqApiKey = config.ai.groqApiKey,
    groqModel = config.ai.groqModel
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.groqApiKey = groqApiKey;
    this.groqModel = groqModel;
    this.cache = visionCache;
  }

  /**
   * Base64 formatındaki ambalaj görselinden INCI içerik listesini ve ürün bilgilerini ayıklar.
   * @param {Object} params
   * @param {string} params.base64Data - Saf base64 veya data:image/... URI
   * @param {string} [params.mimeType="image/jpeg"] - Görsel MIME tipi
   * @returns {Promise<{ ingredientsText: string, detectedProductName: string|null, detectedBrand: string|null, confidence: string }>}
   */
  async extractIngredientsFromImage({ base64Data, mimeType = "image/jpeg" }) {
    if (!base64Data) {
      throw new Error("Görsel verisi (base64) boş olamaz.");
    }

    // data:image/jpeg;base64,... önekini temizle
    let cleanBase64 = base64Data;
    let resolvedMime = mimeType;
    if (base64Data.startsWith("data:")) {
      const parts = base64Data.split(",");
      const match = parts[0].match(/:(.*?);/);
      if (match) {
        resolvedMime = match[1];
      }
      cleanBase64 = parts[1] || "";
    }

    // 0ms / 0 TL Maliyet: Görsel Hash'i ile Önbellek Kontrolü
    const imageHash = crypto.createHash("sha256").update(cleanBase64.slice(0, 5000) + cleanBase64.length).digest("hex");
    if (this.cache.has(imageHash)) {
      logger.info("Vision OCR önbellekten getirildi (0 TL API maliyeti, 0ms)", { hash: imageHash.slice(0, 10) });
      return { ...this.cache.get(imageHash), isCached: true };
    }

    // API anahtarı kontrolü: Gemini veya Groq anahtarı mevcut mu?
    // Groq ayrıca açıkça bir vision modeli (GROQ_VISION_MODEL) tanımlanmasını şart koşar;
    // aksi halde kullanımdan kaldırılmış bir modele boşa istek atılır.
    const hasGemini = Boolean(this.apiKey && this.apiKey.trim().length > 10);
    const hasGroq = Boolean(
      this.groqApiKey && this.groqApiKey.trim().length > 10 && this.groqModel && this.groqModel.trim()
    );

    if (!hasGemini && !hasGroq) {
      logger.warn("Geçerli bir AI API anahtarı (GEMINI_API_KEY veya GROQ_API_KEY) bulunamadı, yerel simülasyon modunda çalışıyor.");
      const mockResult = {
        ingredientsText: "Aqua, Glycerin, Niacinamide, Panthenol, Phenoxyethanol, Sodium Hyaluronate",
        detectedProductName: "Fit Me Matte + Poreless",
        detectedBrand: "Maybelline",
        detectedCategory: "Fondöten / Foundation",
        detectedShade: "120 Classic Ivory",
        isFrontCover: false,
        confidence: "MEDIUM",
        isSimulated: true
      };
      this._setCache(imageHash, mockResult);
      return mockResult;
    }

    const systemInstruction = `Sen uzman bir kozmetik, cilt bakımı ve makyaj ambalajı okuyucu Vision/OCR yapay zeka asistanısın.
Görseldeki kozmetik ürününü, şişesini veya tüpünü dikkatle incele:
1. Görsel ambalajın veya şişenin ÖN YÜZÜ mü (marka logosu, ürün adı, 'Serum', 'Cream', 'SPF 50', renk/ton bilgisi) yoksa ARKA YÜZÜ mü ('Ingredients', 'İçindekiler', 'Composition' listesi) olduğunu belirle.
2. Kutusu atılmış şişelerde bile ön yüzdeki Marka (detectedBrand), Ürün/Seri Adı (detectedProductName: örn. 'Hyaluronic Acid 2% + B5'), Ürün Kategorisi (detectedCategory: Serum, Nemlendirici, Güneş Kremi, Fondöten vb.) ve Renk/Ton/Hacim kodunu (detectedShade) eksiksiz tespit et.
3. Varsa 'Ingredients', 'İçindekiler' başlığı altındaki kimyasal bileşenleri (INCI) virgülle ayrılmış olarak 'ingredientsText' alanına yaz. Ön yüzde kimyasal liste yoksa 'ingredientsText': "" ve 'isFrontCover': true olarak işaretle.
4. Çıktıyı SADECE aşağıdaki JSON formatında ver:
{
  "ingredientsText": "Aqua, Glycerin, Niacinamide..." veya "",
  "detectedProductName": "Ürün adı veya null",
  "detectedBrand": "Marka adı veya null",
  "detectedCategory": "Serum / Nemlendirici / Temizleyici / vb. veya null",
  "detectedShade": "Ton veya ml hacmi / null",
  "isFrontCover": true | false,
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

    let parsed = null;
    // Aynı istek içinde zaten başarısız olmuş sağlayıcıya ikinci kez gitmemek için.
    let groqAttempted = false;

    // 1. Tercih: Groq Vision (eğer provider='groq' ise veya Gemini anahtarı yoksa)
    if (hasGroq && (config.ai.provider === "groq" || !hasGemini)) {
      groqAttempted = true;
      try {
        parsed = await this._callGroqVision({ cleanBase64, resolvedMime, systemInstruction });
      } catch (groqErr) {
        logger.warn("Groq Vision çağrısı başarısız oldu:", { error: groqErr.message });
      }
    }

    // 2. Tercih: Gemini Vision (eğer parsed henüz alınamadıysa ve hasGemini varsa)
    if (!parsed && hasGemini) {
      try {
        parsed = await this._callGeminiVision({ cleanBase64, resolvedMime, systemInstruction });
      } catch (geminiErr) {
        logger.warn("Gemini Vision çağrısı başarısız oldu:", { error: geminiErr.message });
        // Gemini başarısız olursa Groq yedek olarak devrede mi?
        // Groq bu istekte zaten denenip başarısız olduysa boşa ikinci bir API çağrısı
        // yapılmaz; eskiden her iki sağlayıcı da düştüğünde üç istek atılıyordu.
        if (hasGroq && !groqAttempted) {
          try {
            logger.info("Yedek olarak Groq Vision API deneniyor...");
            parsed = await this._callGroqVision({ cleanBase64, resolvedMime, systemInstruction });
          } catch (groqFallbackErr) {
            logger.error("Groq yedek çağrısı da başarısız:", { error: groqFallbackErr.message });
          }
        }
      }
    }

    if (!parsed) {
      return {
        ingredientsText: "",
        detectedProductName: null,
        detectedBrand: null,
        detectedCategory: null,
        detectedShade: null,
        isFrontCover: true,
        confidence: "LOW",
        error: "Görselden metin veya marka okunamadı. Lütfen ışığı ayarlayarak ambalajın ön yüzünü veya 'Ingredients' kısmını tekrar çekiniz."
      };
    }

    const isFrontCover = parsed.isFrontCover ?? (!parsed.ingredientsText || parsed.ingredientsText.trim().length < 10);
    const result = {
      ingredientsText: parsed.ingredientsText || "",
      detectedProductName: parsed.detectedProductName || null,
      detectedBrand: parsed.detectedBrand || null,
      detectedCategory: parsed.detectedCategory || null,
      detectedShade: parsed.detectedShade || null,
      isFrontCover: Boolean(isFrontCover),
      confidence: parsed.confidence || "MEDIUM"
    };

    this._setCache(imageHash, result);
    return result;
  }

  async _callGeminiVision({ cleanBase64, resolvedMime, systemInstruction }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Lütfen bu kozmetik ambalajındaki tüm bilgileri (marka, ürün adı, INCI içerikleri) oku ve standart JSON formatında çıkar."
            },
            {
              inlineData: {
                mimeType: resolvedMime,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini Vision API: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Gemini görselde okunabilir metin tespit edemedi.");
    }
    return JSON.parse(rawText);
  }

  async _callGroqVision({ cleanBase64, resolvedMime, systemInstruction }) {
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";
    const body = {
      model: this.groqModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${systemInstruction}\n\nLütfen görseldeki ambalajı veya şişeyi inceleyip belirtilen JSON şemasında yanıt ver.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${resolvedMime};base64,${cleanBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq Vision API: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error("Groq görselde metin tespit edemedi.");
    }
    return JSON.parse(rawText);
  }

  _setCache(key, value) {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

module.exports = GeminiVisionOcrService;
