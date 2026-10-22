// public/js/scanner/BackendVisionOcrStrategy.js - Backend Çok Modlu Görsel OCR Stratejisi
// Gerekçe: Tarayıcı ve hibrit ortamlarda görseli sunucuya ileterek yapay zeka görüşüyle (Gemini Vision) içerik listesini ayıklamak.
import { IOcrStrategy } from "./IOcrStrategy.js";

export class BackendVisionOcrStrategy extends IOcrStrategy {
  async isSupported() {
    // Tüm modern ortamlarda fetch desteklendiği için her zaman aktiftir (Evrensel Fallback)
    return typeof fetch === "function";
  }

  /**
   * Görsel kaynağından Base64 metin üretir
   * @param {Blob|File|HTMLImageElement|HTMLCanvasElement} imageSource
   * @returns {Promise<string>}
   */
  async toBase64(imageSource) {
    if (typeof imageSource === "string" && imageSource.startsWith("data:")) {
      return imageSource;
    }

    if (imageSource instanceof HTMLCanvasElement) {
      return imageSource.toDataURL("image/jpeg", 0.85);
    }

    if (imageSource instanceof HTMLImageElement) {
      const canvas = document.createElement("canvas");
      canvas.width = imageSource.naturalWidth || imageSource.width;
      canvas.height = imageSource.naturalHeight || imageSource.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imageSource, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.85);
    }

    if (imageSource instanceof Blob || imageSource instanceof File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Görsel dosyası base64'e dönüştürülemedi."));
        reader.readAsDataURL(imageSource);
      });
    }

    throw new Error("Geçersiz görsel kaynağı.");
  }

  /**
   * Backend Vision OCR endpoint'ine görseli gönderir
   * @param {Blob|File|HTMLImageElement|HTMLCanvasElement} imageSource
   * @returns {Promise<{ ingredientsText: string, detectedProductName?: string, detectedBrand?: string, confidence?: string }>}
   */
  async recognize(imageSource) {
    const base64Data = await this.toBase64(imageSource);

    const response = await fetch("/api/v1/analyze/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        image: base64Data,
        mimeType: "image/jpeg",
        autoAnalyze: false
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const message = errorJson.error?.message || "Görselden metin ayrıştırılamadı.";
      throw new Error(message);
    }

    const payload = await response.json();
    if (!payload.success || !payload.data) {
      throw new Error("OCR servisi beklenen formatta veri döndürmedi.");
    }

    return {
      ingredientsText: payload.data.ingredientsText || "",
      detectedProductName: payload.data.detectedProductName || null,
      detectedBrand: payload.data.detectedBrand || null,
      confidence: payload.data.confidence || "MEDIUM"
    };
  }
}
