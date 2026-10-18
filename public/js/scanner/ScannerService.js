// public/js/scanner/ScannerService.js - Kamera ve Tarama Yaşam Döngüsü Yöneticisi (Facade Pattern)
// Gerekçe: Kamera donanım erişimini, stream kaynaklarının kapatılmasını ve barkod tespit stratejisini tek bir güvenli arayüz arkasında toplamak için.
import { NativeBarcodeStrategy } from "./NativeBarcodeStrategy.js";
import { FallbackBarcodeStrategy } from "./FallbackBarcodeStrategy.js";
import { CapacitorBarcodeStrategy } from "./CapacitorBarcodeStrategy.js";

export class ScannerService {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.animationFrameId = null;
    this.isScanning = false;
    this.strategy = null;
  }

  async resolveStrategy() {
    if (!this.strategy) {
      // 1. Native Mobil (Capacitor) Önceliği
      const capacitorStrategy = new CapacitorBarcodeStrategy();
      if (await capacitorStrategy.isSupported()) {
        this.strategy = capacitorStrategy;
        return this.strategy;
      }

      // 2. Tarayıcı Yerleşik BarcodeDetector API'si
      const nativeStrategy = new NativeBarcodeStrategy();
      if (await nativeStrategy.isSupported()) {
        this.strategy = nativeStrategy;
        return this.strategy;
      }

      // 3. Yedek Tarayıcı Stratejisi
      this.strategy = new FallbackBarcodeStrategy();
    }
    return this.strategy;
  }

  /**
   * Arka kamerayı başlatır ve canlı barkod taramaya başlar
   * @param {HTMLVideoElement} videoElement
   * @param {Function} onDetected - Barkod okunduğunda çağrılır
   * @param {Function} onError - Hata oluştuğunda anlaşılır mesajla çağrılır
   */
  async startLiveCamera(videoElement, onDetected, onError) {
    this.videoElement = videoElement;

    // HTTPS veya Localhost kontrolü (Tarayıcı güvenlik standardı)
    const isSecureOrigin = window.location.protocol === "https:" || 
                           window.location.hostname === "localhost" || 
                           window.location.hostname === "127.0.0.1";

    if (!isSecureOrigin) {
      onError(new Error("Kamera erişimi için HTTPS veya localhost bağlantısı gereklidir. Lütfen güvenli bağlantı üzerinden açınız veya manuel barkod girişini kullanınız."));
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError(new Error("Tarayıcınız kamera erişimini desteklemiyor. Lütfen fotoğraf yükleme veya manuel giriş yöntemini kullanınız."));
      return;
    }

    try {
      // Arka kamera (environment) önceliği
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.isScanning = true;
      const strategy = await this.resolveStrategy();

      // Döngüsel tarama
      const scanLoop = async () => {
        if (!this.isScanning) return;

        if (this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            const barcode = await strategy.detect(this.videoElement);
            if (barcode) {
              this.stopCamera();
              onDetected(barcode);
              return;
            }
          } catch (_) {}
        }

        this.animationFrameId = requestAnimationFrame(scanLoop);
      };

      this.animationFrameId = requestAnimationFrame(scanLoop);
    } catch (err) {
      this.stopCamera();
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        onError(new Error("Kamera erişim izni reddedildi. Tarayıcı adres çubuğundaki kilit simgesinden izin verebilir veya manuel barkod girebilirsiniz."));
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        onError(new Error("Cihazınızda kullanılabilir kamera bulunamadı. Lütfen manuel giriş yapınız."));
      } else {
        onError(new Error(`Kamera başlatılamadı: ${err.message}`));
      }
    }
  }

  /**
   * Kamera akışını ve donanım ışığını MUTLAKA kapatır (Resource Cleanup)
   */
  stopCamera() {
    this.isScanning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      const tracks = this.stream.getTracks();
      for (const track of tracks) {
        track.stop();
      }
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  /**
   * Yüklenen fotoğrafı istemci tarafında boyutlandırır ve EXIF bilgilerini arındırır
   * @param {File} file
   * @param {number} maxDimension
   * @returns {Promise<Blob>}
   */
  static async resizeAndStripExif(file, maxDimension = 1200) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Lütfen yalnızca geçerli bir resim dosyası seçiniz (JPEG, PNG, WebP).");
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("Dosya boyutu çok büyük (En fazla 15MB).");
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;

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
        // Canvas üzerine çizim yapmak tüm EXIF başlıklarını doğal olarak temizler
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Resim optimize edilemedi."));
        }, "image/jpeg", 0.85);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Resim dosyası açılamadı."));
      };

      img.src = objectUrl;
    });
  }
}

export const scannerService = new ScannerService();
