// public/js/services/scanService.js - Tarama ve Uyumluluk Analizi Servisi (Facade & DIP)
// Gerekçe: Ürün sorgulama ve uyumluluk analiz işlemlerini tek bir servis çağrısı arkasında toplamak için.
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";

export class ScanService {
  constructor(client = apiClient) {
    this.client = client;
  }

  async getProductByBarcode(barcode) {
    const res = await this.client.get(ENDPOINTS.PRODUCT_BY_BARCODE(barcode));
    return res.data;
  }

  async checkBarcodeCompatibility(barcode) {
    const res = await this.client.post(ENDPOINTS.PROFILE_CHECK_COMPATIBILITY, { barcode });
    return res.data;
  }

  async checkTextCompatibility(rawIngredientsText) {
    const res = await this.client.post(ENDPOINTS.PROFILE_CHECK_COMPATIBILITY, { rawIngredientsText });
    return res.data;
  }

  async analyzeRawIngredients(ingredientsText) {
    const res = await this.client.post(ENDPOINTS.ANALYZE_RAW, { ingredientsText });
    return res.data;
  }

  async searchProducts(query, limit = 10) {
    const res = await this.client.get(`${ENDPOINTS.PRODUCTS_SEARCH}?q=${encodeURIComponent(query)}&limit=${limit}`);
    return res.data;
  }
}

export const scanService = new ScanService();
