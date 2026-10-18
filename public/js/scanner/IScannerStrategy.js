// public/js/scanner/IScannerStrategy.js - Barkod Tarama Strateji Arayüzü (Strategy Pattern)
// Gerekçe: Tarayıcının yerel BarcodeDetector API'si ile yedek kütüphaneler/fallback yöntemlerinin şeffaf biçimde değiştirilebilmesi için.

export class IScannerStrategy {
  /**
   * Tarayıcının bu stratejiyi destekleyip desteklemediğini kontrol eder
   * @returns {Promise<boolean>|boolean}
   */
  async isSupported() {
    throw new Error("Method isSupported() must be implemented.");
  }

  /**
   * Bir Video öğesi veya Canvas üzerinden barkod tespit eder
   * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} source
   * @returns {Promise<string|null>} - Okunan barkod metni
   */
  async detect(source) {
    throw new Error("Method detect() must be implemented.");
  }
}
