// public/js/scanner/CapacitorBarcodeStrategy.js - Native Mobil (Android/iOS) ML Kit Barkod Stratejisi (Strategy Pattern)
// Gerekçe: App Store ve Play Store mobil uygulamasında telefonun donanımsal kamerasını 60 FPS hızla ve Google ML Kit ile taramak için.
import { IScannerStrategy } from "./IScannerStrategy.js";

export class CapacitorBarcodeStrategy extends IScannerStrategy {
  // ScannerService bu işarete bakarak native ortamda getUserMedia yolunu atlar.
  get isNative() {
    return true;
  }

  async isSupported() {
    return typeof window !== "undefined" && 
           window.Capacitor !== undefined && 
           window.Capacitor.isPluginAvailable("BarcodeScanner");
  }

  async detect(source = null) {
    // Galeriden gelen bir görsel için native tarayıcı kullanılmaz; o akış
    // görsel tabanlı okuyucuya / BackendVisionOcrStrategy'ye aittir.
    // Aksi halde kullanıcı fotoğraf yüklediğinde beklenmedik şekilde kamera açılıyordu.
    if (source) return null;

    try {
      const { BarcodeScanner } = window.Capacitor.Plugins;
      // İzin kontrolü ve talebi
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== "granted") {
        const req = await BarcodeScanner.requestPermissions();
        if (req.camera !== "granted") {
          throw new Error("Kamera izni verilmedi.");
        }
      }

      const result = await BarcodeScanner.scan();
      if (result && result.barcodes && result.barcodes.length > 0) {
        return result.barcodes[0].rawValue;
      }
      return null;
    } catch (err) {
      console.warn("Capacitor BarcodeScanner error:", err);
      return null;
    }
  }
}
