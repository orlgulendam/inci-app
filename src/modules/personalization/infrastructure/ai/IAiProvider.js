// src/modules/personalization/infrastructure/ai/IAiProvider.js - AI Sağlayıcı Strateji Arayüzü (Strategy Pattern)
// Gerekçe: Gemini ve Fallback sağlayıcılarının birbirinin yerine geçebilmesi için ortak arayüz.
class IAiProvider {
  /**
   * @param {Object} params
   * @param {string} params.message - Kullanıcı sorusu
   * @param {Object} params.safeProfile - İsim/not gibi hassas bilgilerden arındırılmış cilt profili
   * @param {Array<string>} params.ingredients - İncelenen ürünün içerik listesi (varsa)
   * @param {Array<Object>} params.history - Sohbet geçmişi
   * @returns {Promise<{ reply: string, suggestions?: string[], provider: string }>}
   */
  async generateChatResponse(params) {
    throw new Error("Method generateChatResponse() must be implemented.");
  }
}

module.exports = IAiProvider;
