// src/modules/analysis/infrastructure/ocr/GeminiVisionOcrService.js - Çok Modlu (Multimodal) Görsel OCR Servisi
// Gerekçe: Ambalaj üzerindeki kıvrımlı, küçük ve silik "Ingredients" metinlerini yapay zeka görüşüyle (Vision) kusursuz ayıklamak için.
const config = require("../../../../core/config/env");
const logger = require("../../../../core/logging/logger");

class GeminiVisionOcrService {
  constructor(apiKey = config.ai.geminiApiKey, model = config.ai.geminiModel || "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
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

    // API anahtarı yoksa veya test ortamındaysa güvenli mock geri dönüş
    if (!this.apiKey) {
      logger.warn("GEMINI_API_KEY bulunamadı, OCR servisi yerel simülasyon modunda çalışıyor.");
      return {
        ingredientsText: "Aqua, Glycerin, Niacinamide, Panthenol, Phenoxyethanol, Sodium Hyaluronate",
        detectedProductName: "Örnek Nemlendirici Serum",
        detectedBrand: "Tespit Edilen Marka",
        confidence: "MEDIUM",
        isSimulated: true
      };
    }

    const systemInstruction = `Sen uzman bir kozmetik içerik (INCI) okuyucu OCR yapay zeka asistanısın.
Görseldeki kozmetik ürün ambalajını dikkatle incele:
1. 'Ingredients', 'İçindekiler', 'Composition', 'Coctab' başlıkları altındaki tüm kimyasal bileşenleri tespit et.
2. Yazım hatalarını kimyasal INCI literatürüne göre düzelt (örneğin 'Niacinamid' yerine 'Niacinamide', 'Gliserin' yerine 'Glycerin').
3. Görselde ürün adı veya marka net olarak okunabiliyorsa tespit et.
4. Çıktıyı SADECE aşağıdaki JSON formatında ver:
{
  "ingredientsText": "Aqua, Glycerin, Niacinamide...",
  "detectedProductName": "Ürün adı veya null",
  "detectedBrand": "Marka adı veya null",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

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
              text: "Lütfen bu kozmetik ambalajındaki tüm içerik (INCI) listesini oku ve standart JSON formatında çıkar."
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

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.warn(`Gemini Vision API yanıt vermedi: ${res.status} - ${errorText}`);
        throw new Error(`Vision API hatası: ${res.status}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Yapay zeka görselde okunabilir metin tespit edemedi.");
      }

      const parsed = JSON.parse(rawText);
      return {
        ingredientsText: parsed.ingredientsText || "",
        detectedProductName: parsed.detectedProductName || null,
        detectedBrand: parsed.detectedBrand || null,
        confidence: parsed.confidence || "MEDIUM"
      };
    } catch (err) {
      logger.error("Görsel OCR işleminde hata oluştu:", { error: err.message });
      // Hata durumunda uygulamanın kilitlenmesini engelle, güvenli yedek dön
      return {
        ingredientsText: "",
        detectedProductName: null,
        detectedBrand: null,
        confidence: "LOW",
        error: "Görselden metin okunamadı, lütfen içerik metnini manuel giriniz veya daha net bir fotoğraf çekiniz."
      };
    }
  }
}

module.exports = GeminiVisionOcrService;
