// src/modules/personalization/application/services/ChatService.js - AI Sohbet ve Danışmanlık Servisi (SRP & OCP)
const AiPrivacyGuard = require("../../domain/services/AiPrivacyGuard");
const logger = require("../../../../core/logging/logger");
const { ValidationError } = require("../../../../core/errors/AppError");

class ChatService {
  constructor({ userRepository, catalogFacade = null, primaryAiProvider, fallbackAiProvider }) {
    this.userRepository = userRepository;
    this.catalogFacade = catalogFacade;
    this.primaryAiProvider = primaryAiProvider;
    this.fallbackAiProvider = fallbackAiProvider;
  }

  async askAssistant({ userId = null, message, barcode = null, rawIngredients = [], history = [] }) {
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new ValidationError("Soru metni boş olamaz.");
    }

    // 1. Kullanıcı Profili ve Gizlilik Filtresi (KVKK)
    let safeProfile = { skinType: "normal", conditions: [], allergicIngredients: [], targetedBenefits: [] };
    if (userId) {
      const user = await this.userRepository.findById(userId);
      if (user && user.skinProfile) {
        safeProfile = AiPrivacyGuard.sanitizeForAi(user.skinProfile);
      }
    }

    // 2. Ürün İçeriklerini Zenginleştirme (Barcode verildiyse katalogdan çek)
    let ingredientsList = Array.isArray(rawIngredients) ? [...rawIngredients] : [];
    if (barcode && this.catalogFacade && ingredientsList.length === 0) {
      try {
        const product = await this.catalogFacade.getProductByBarcode(barcode);
        if (product && Array.isArray(product.rawIngredients)) {
          ingredientsList = product.rawIngredients;
        }
      } catch (err) {
        logger.warn(`Could not fetch product ingredients for chat: ${err.message}`);
      }
    }

    // 3. AI Sağlayıcı Çağrısı (Primary: Gemini Flash, Fallback: Kural Tabanlı Uzman Motoru)
    let response = null;
    let isRateLimited = false;

    try {
      // Birincil sağlayıcıyı dene
      response = await this.primaryAiProvider.generateChatResponse({
        message,
        safeProfile,
        ingredients: ingredientsList,
        history
      });

      // Şema doğrulama (reply alanı mutlaka string olmalı)
      if (!response || typeof response.reply !== "string") {
        throw new Error("Geçersiz AI yanıt şeması.");
      }
    } catch (primaryErr) {
      if (primaryErr.code === "RATE_LIMIT_EXCEEDED" || primaryErr.status === 429) {
        logger.warn("Gemini API kota sınırı (429) aşıldı, yedek sağlayıcıya geçiliyor.");
        isRateLimited = true;
      } else {
        logger.warn(`Gemini API çağrısı başarısız oldu (${primaryErr.message}), yedek sağlayıcıya geçiliyor.`);
      }

      // Şema hatasında bir kez yeniden dene, yine olmazsa fallback'e geç
      if (primaryErr.message === "Geçersiz AI yanıt şeması.") {
        try {
          response = await this.primaryAiProvider.generateChatResponse({
            message,
            safeProfile,
            ingredients: ingredientsList,
            history
          });
        } catch (_) {
          // İkinci deneme de başarısızsa fallback'e düş
        }
      }

      // Eğer hala yanıt alınamadıysa Fallback Sağlayıcıyı devreye al
      if (!response) {
        response = await this.fallbackAiProvider.generateChatResponse({
          message,
          safeProfile,
          ingredients: ingredientsList,
          isRateLimited
        });
      }
    }

    return {
      reply: response.reply,
      suggestions: response.suggestions || [],
      compatibilityVerdict: response.compatibilityVerdict || "BILGI",
      provider: response.provider,
      disclaimer: "Bu bilgiler tıbbi tavsiye değildir, dermatoloğunuza danışın."
    };
  }
}

module.exports = ChatService;
