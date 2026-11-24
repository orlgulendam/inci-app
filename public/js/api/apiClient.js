// public/js/api/apiClient.js - HTTP İstemci Adaptörü (Adapter Pattern)
// Gerekçe: Tarayıcı fetch API'sini ve backend standart hata/yanıt formatını tek merkezden yönetmek, 401 durumunda oturum kapatmak için.
import { MOBILE_API_BASE_URL, API_BASE_URL_STORAGE_KEY } from "../config.js";

class ApiClient {
  constructor({ baseUrl = "", timeoutMs = 12000, onUnauthorized = null } = {}) {
    // Mobil / Capacitor WebView ortamında yerel sunucuya veya konfigüre edilen API'ye bağlanma desteği.
    // Adres js/config.js dosyasından okunur; cihazda yeniden derlemeden değiştirmek için
    // localStorage üzerinden geçersiz kılınabilir.
    if (!baseUrl) {
      const isCapacitor = window.Capacitor !== undefined || window.location.protocol === "capacitor:";
      if (isCapacitor) {
        baseUrl = localStorage.getItem(API_BASE_URL_STORAGE_KEY) || MOBILE_API_BASE_URL;
      }
    }
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.onUnauthorized = onUnauthorized;
    this.tokenGetter = () => sessionStorage.getItem("inci_token") || localStorage.getItem("inci_token") || null;
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }

  setTokenGetter(getter) {
    this.tokenGetter = getter;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const token = this.tokenGetter ? this.tokenGetter() : null;
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 401 Yetkisiz Erişim Durumu.
      // Bağlam da iletilir: istek bir token İLE gönderildiyse oturum gerçekten
      // düşmüştür. Token olmadan gelen 401 ise sadece "bu uç nokta giriş ister"
      // demektir; misafir kullanıcıyı oturumu bitmiş gibi uyarmak yanlış olur.
      if (response.status === 401) {
        if (typeof this.onUnauthorized === "function") {
          this.onUnauthorized({ hadToken: Boolean(token), endpoint });
        }
      }

      const isJson = (response.headers.get("content-type") || "").includes("application/json");
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        // Backend standart hata şemasını normalize et
        const errorPayload = typeof data === "object" && data.error ? data.error : {};
        const normalizedError = new Error(errorPayload.message || response.statusText || "Sunucu hatası oluştu.");
        normalizedError.status = response.status;
        normalizedError.code = errorPayload.code || "HTTP_ERROR";
        normalizedError.correlationId = errorPayload.correlationId || null;
        normalizedError.details = errorPayload.details || null;
        throw normalizedError;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        const timeoutError = new Error("İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
        timeoutError.code = "TIMEOUT_ERROR";
        throw timeoutError;
      }
      // fetch'in kendisi başarısız olduysa (TypeError) sunucuya hiç ulaşılamamıştır.
      // Mobilde bunun en sık nedeni yanlış API adresi veya engellenen cleartext isteğidir;
      // çıplak "Failed to fetch" mesajı teşhis için yetersiz kalıyordu.
      if (err instanceof TypeError) {
        const networkError = new Error(
          `API sunucusuna ulaşılamadı (${this.baseUrl || "aynı köken"}). ` +
          "Sunucunun çalıştığını ve js/config.js içindeki adresin bu cihazdan erişilebilir olduğunu doğrulayın."
        );
        networkError.code = "NETWORK_UNREACHABLE";
        networkError.cause = err;
        throw networkError;
      }
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
