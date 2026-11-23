// public/js/scanner/BackendVisionOcrStrategy.js - Backend Çok Modlu Görsel OCR Stratejisi
// Gerekçe: Tarayıcı ve hibrit ortamlarda görseli sunucuya ileterek yapay zeka görüşüyle (Gemini Vision) içerik listesini ayıklamak.
import { IOcrStrategy } from "./IOcrStrategy.js";
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";

export class BackendVisionOcrStrategy extends IOcrStrategy {
  async isSupported() {
    // Tüm modern ortamlarda fetch desteklendiği için her zaman aktiftir (Evrensel Fallback)
    return typeof fetch === "function";
  }

  /**
   * Görsel kaynağını istemci tarafında optimize edip (max 1280px, JPEG 0.85) Base64'e dönüştürür
   * @param {Blob|File|HTMLImageElement|HTMLCanvasElement|string} imageSource
   * @returns {Promise<string>}
   */
  async toBase64(imageSource) {
    const rawDataUrl = await this._readToDataUrl(imageSource);
    return this._resizeAndCompress(rawDataUrl, 1280, 0.85);
  }

  async _readToDataUrl(source) {
    if (typeof source === "string" && source.startsWith("data:")) {
      return source;
    }
    if (source instanceof HTMLCanvasElement) {
      return source.toDataURL("image/jpeg", 0.9);
    }
    if (source instanceof HTMLImageElement) {
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth || source.width;
      canvas.height = source.naturalHeight || source.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(source, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.9);
    }
    if (source instanceof Blob || source instanceof File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Görsel dosyası okunamadı."));
        reader.readAsDataURL(source);
      });
    }
    throw new Error("Geçersiz görsel kaynağı.");
  }

  _resizeAndCompress(dataUrl, maxDimension = 1280, quality = 0.85) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(dataUrl); // fallback to original
      img.src = dataUrl;
    });
  }

  /**
   * Backend Vision OCR endpoint'ine görseli gönderir
   * @param {Blob|File|HTMLImageElement|HTMLCanvasElement} imageSource
   * @returns {Promise<{ ingredientsText: string, detectedProductName?: string, detectedBrand?: string, confidence?: string }>}
   */
  async recognize(imageSource) {
    const base64Data = await this.toBase64(imageSource);

    // apiClient üzerinden gönderilir: Capacitor WebView’de sayfa kökeni https://localhost
    // olduğu için ham göreli fetch("/api/v1/...") istekleri API sunucusuna HİÇ ulaşmıyor,
    // uygulamanın kendi paketlenmiş varlıklarına gidip mobilde OCR tamamen çöküyordu.
    // apiClient mobilde MOBILE_API_BASE_URL önekini ve JWT başlığını ekler.
    const payload = await apiClient.post(ENDPOINTS.ANALYZE_OCR, {
      image: base64Data,
      mimeType: "image/jpeg",
      autoAnalyze: false
    });

    if (!payload || !payload.success || !payload.data) {
      throw new Error("OCR servisi beklenen formatta veri döndürmedi.");
    }

    return {
      ingredientsText: payload.data.ingredientsText || "",
      detectedProductName: payload.data.detectedProductName || null,
      detectedBrand: payload.data.detectedBrand || null,
      detectedCategory: payload.data.detectedCategory || null,
      detectedShade: payload.data.detectedShade || null,
      isFrontCover: Boolean(payload.data.isFrontCover),
      confidence: payload.data.confidence || "MEDIUM",
      error: payload.data.error || null
    };
  }
}
