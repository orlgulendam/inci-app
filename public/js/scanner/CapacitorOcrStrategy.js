// public/js/scanner/CapacitorOcrStrategy.js - Native Mobil (Capacitor) OCR Stratejisi
// Gerekçe: Android ve iOS cihazlarda donanım seviyesinde Google ML Kit Text Recognition çalıştırmak.
import { IOcrStrategy } from "./IOcrStrategy.js";
import { BackendVisionOcrStrategy } from "./BackendVisionOcrStrategy.js";

export class CapacitorOcrStrategy extends IOcrStrategy {
  constructor() {
    super();
    this.fallbackStrategy = new BackendVisionOcrStrategy();
  }

  async isSupported() {
    return typeof window !== "undefined" &&
           window.Capacitor &&
           typeof window.Capacitor.isPluginAvailable === "function" &&
           window.Capacitor.isPluginAvailable("OcrScanner");
  }

  async recognize(imageSource) {
    if (await this.isSupported()) {
      try {
        const { OcrScanner } = window.Capacitor.Plugins;
        const result = await OcrScanner.processImage({ image: imageSource });
        if (result && result.text) {
          return {
            ingredientsText: result.text,
            detectedProductName: null,
            detectedBrand: null,
            confidence: "HIGH"
          };
        }
      } catch (err) {
        console.warn("Capacitor OcrScanner hatası, Backend Vision stratejisine geçiliyor:", err);
      }
    }

    // Eklenti yoksa veya hata verirse bulut vision stratejisine geç
    return this.fallbackStrategy.recognize(imageSource);
  }
}
