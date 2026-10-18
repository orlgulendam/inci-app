// public/js/api/apiClient.js - HTTP İstemci Adaptörü (Adapter Pattern)
// Gerekçe: Tarayıcı fetch API'sini ve backend standart hata/yanıt formatını tek merkezden yönetmek, 401 durumunda oturum kapatmak için.

class ApiClient {
  constructor({ baseUrl = "", timeoutMs = 12000, onUnauthorized = null } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.onUnauthorized = onUnauthorized;
    this.tokenGetter = () => sessionStorage.getItem("inci_token") || null;
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

      // 401 Yetkisiz Erişim Durumu (Token süresi dolmuş veya geçersiz)
      if (response.status === 401) {
        if (typeof this.onUnauthorized === "function") {
          this.onUnauthorized();
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
