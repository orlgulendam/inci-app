// public/js/scanner/IOcrStrategy.js - OCR Metin Tanıma Strateji Arayüzü (Strategy Pattern)
// Gerekçe: Görselden metin çıkarma işlemini cihaz donanımına (Capacitor/Tarayıcı) göre soyutlamak için.

export class IOcrStrategy {
  /**
   * Stratejinin mevcut çalışma ortamında desteklenip desteklenmediğini döner
   * @returns {Promise<boolean>}
   */
  async isSupported() {
    throw new Error("isSupported() metodu alt sınıfta uygulanmalıdır.");
  }

  /**
   * Verilen görsel kaynağından (Blob, File, Canvas, Image) metin okur
   * @param {Blob|File|HTMLImageElement|HTMLCanvasElement} imageSource
   * @returns {Promise<{ ingredientsText: string, detectedProductName?: string, detectedBrand?: string, confidence?: string }>}
   */
  async recognize(imageSource) {
    throw new Error("recognize() metodu alt sınıfta uygulanmalıdır.");
  }
}
