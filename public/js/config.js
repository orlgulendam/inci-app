// public/js/config.js - İstemci Tarafı Çalışma Zamanı Konfigürasyonu
// Gerekçe: Mobil (Capacitor) derlemesinde API adresinin tek bir yerden yönetilmesi.
// Bu dosya `npx cap sync` ile otomatik olarak Android/iOS varlıklarına kopyalanır.

/**
 * Mobil uygulamanın bağlanacağı API adresi.
 *
 * Web tarayıcısında bu değer KULLANILMAZ; sayfa zaten API ile aynı kökenden
 * servis edildiği için göreli (relative) istek atılır.
 *
 * Capacitor WebView'inde ise sayfa `https://localhost` kökeninden açılır, yani
 * API'nin tam adresi verilmek zorundadır. Ortamına göre şunlardan birini seç:
 *
 *   Android emülatörü      : "http://10.0.2.2:3000"   (ana makinenin localhost'u)
 *   iOS simülatörü         : "http://localhost:3000"
 *   Aynı Wi-Fi'daki cihaz  : "http://192.168.1.X:3000" (bilgisayarının yerel IP'si)
 *   Yayın (production)     : "https://api.alan-adin.com"
 *
 * ÖNEMLİ: `http://` ile başlayan bir adres kullanıyorsan capacitor.config.json
 * içinde `android.allowMixedContent: true` ayarı gereklidir; aksi halde WebView
 * https kökeninden yapılan cleartext isteklerin TAMAMINI sessizce engeller.
 * Yayına çıkarken API'yi https'e taşı ve bu ayarı kaldır.
 */
export const MOBILE_API_BASE_URL = "http://10.0.2.2:3000";

/**
 * Çalışma zamanında geçersiz kılma anahtarı.
 * Geliştirme sırasında cihazda yeniden derlemeden adres değiştirmek için:
 *   localStorage.setItem("inci_api_base_url", "http://192.168.1.42:3000")
 */
export const API_BASE_URL_STORAGE_KEY = "inci_api_base_url";
