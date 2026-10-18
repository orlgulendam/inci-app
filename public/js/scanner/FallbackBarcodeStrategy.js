// public/js/scanner/FallbackBarcodeStrategy.js - Yedek Barkod Tarama Stratejisi (Strategy Pattern)
// Gerekçe: BarcodeDetector desteklenmeyen tarayıcılarda (örn. masaüstü Firefox veya eski Safari) hafif fallback sağlamak için.
import { IScannerStrategy } from "./IScannerStrategy.js";

export class FallbackBarcodeStrategy extends IScannerStrategy {
  async isSupported() {
    return true; // Her zaman kullanılabilir yedek strateji
  }

  async detect(source) {
    // Tarayıcı BarcodeDetector yoksa, resim yükleme ve OCR desteği önceliklendirilir.
    // Eğer sayfaya zxing veya html5-qrcode enjekte edildiyse onu kullanır.
    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
      try {
        const reader = new window.ZXing.BrowserMultiFormatReader();
        const result = await reader.decodeFromImageElement(source);
        return result ? result.getText() : null;
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}
