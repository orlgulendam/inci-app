// public/js/services/communityService.js - Topluluk Katkı Servisi (Gamification)
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";

export class CommunityService {
  constructor(client = apiClient) {
    this.client = client;
  }

  /**
   * Yeni bir ürün katkısı gönderir (+50 puan potansiyeli)
   * @param {Object} data
   * @param {string} data.barcode
   * @param {string} data.productName
   * @param {string} [data.brandName]
   * @param {string} [data.rawIngredientsText]
   * @param {string} [data.imageUrl]
   * @returns {Promise<Object>}
   */
  async submitContribution(data) {
    const res = await this.client.post(ENDPOINTS.COMMUNITY_CONTRIBUTIONS, data);
    return res.data;
  }

  /**
   * Hatalı bir içerik bildirimi gönderir (+20 puan potansiyeli)
   * @param {Object} data
   * @param {string} data.barcode
   * @param {string} [data.productName]
   * @param {string} data.issueDescription
   * @param {string} [data.suggestedCorrection]
   */
  async reportIssue(data) {
    const res = await this.client.post("/api/v1/community/report-issue", data);
    return res.data;
  }
}

export const communityService = new CommunityService();
