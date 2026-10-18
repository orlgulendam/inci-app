// public/js/scanner/NativeBarcodeStrategy.js - Yerleşik Tarayıcı Barkod Tespit Stratejisi (Strategy Pattern)
// Gerekçe: Modern tarayıcılarda (Chrome, Edge, Android Webview) donanım hızlandırmalı sıfır ek yük ile barkod okumak için.
import { IScannerStrategy } from "./IScannerStrategy.js";

export class NativeBarcodeStrategy extends IScannerStrategy {
  constructor() {
    super();
    this.detector = null;
  }

  async isSupported() {
    return "BarcodeDetector" in window;
  }

  async init() {
    if (!this.detector && "BarcodeDetector" in window) {
      try {
        const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
        const desiredFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"];
        const formats = desiredFormats.filter(f => supportedFormats.includes(f));
        this.detector = new window.BarcodeDetector({ formats: formats.length > 0 ? formats : supportedFormats });
      } catch (err) {
        console.warn("BarcodeDetector format initialization warning:", err);
        this.detector = new window.BarcodeDetector();
      }
    }
  }

  async detect(source) {
    if (!this.detector) {
      await this.init();
    }
    if (!this.detector) return null;

    try {
      const barcodes = await this.detector.detect(source);
      if (barcodes && barcodes.length > 0) {
        return barcodes[0].rawValue;
      }
      return null;
    } catch (err) {
      // Çoğunlukla frame boş olduğunda fırlatılır
      return null;
    }
  }
}
