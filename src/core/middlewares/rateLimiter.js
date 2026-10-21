// src/core/middlewares/rateLimiter.js - Kurumsal Kayan Pencereli (Sliding Window) Hız Sınırlayıcı
// Gerekçe: DDoS, brute-force ve API spam saldırılarını engellemek; istemciye standart RateLimit header'ları dönmek.
const { TooManyRequestsError } = require("../errors/AppError");
const config = require("../config/env");

/**
 * Özelleştirilebilir Rate Limiter Middleware Fabrikası
 * @param {Object} options
 * @param {number} [options.windowMs] - Zaman penceresi (milisaniye)
 * @param {number} [options.max] - Pencere başına izin verilen maksimum istek sayısı
 * @param {Function} [options.keyGenerator] - İstemci anahtar üreticisi (varsayılan: IP)
 * @param {boolean} [options.skipInTest] - Test ortamında atlanıp atlanmayacağı
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || config.security.rateLimitWindowMs || 60 * 1000;
  const max = options.max || config.security.rateLimitMax || 100;
  const keyGenerator = options.keyGenerator || ((req) => req.ip || req.connection?.remoteAddress || "127.0.0.1");
  const skipInTest = options.skipInTest !== undefined ? options.skipInTest : (process.env.NODE_ENV === "test");

  // Bellek içi durum deposu: key -> { count: number, resetTime: number }
  const store = new Map();

  // Bellek sızıntısını önlemek için her 5 dakikada bir eski kayıtları temizle
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupTimer.unref) {
    cleanupTimer.unref(); // Node process'inin kapanmasını engellemesin
  }

  const middleware = (req, res, next) => {
    if (skipInTest) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil(record.resetTime / 1000);
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

    // Standart IETF RateLimit HTTP Başlıkları
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetSeconds);

    if (record.count > max) {
      res.setHeader("Retry-After", retryAfterSeconds);
      return next(new TooManyRequestsError(
        `Çok fazla istek gönderildi. Lütfen ${retryAfterSeconds} saniye sonra tekrar deneyin.`
      ));
    }

    next();
  };

  middleware.reset = () => store.clear();
  return middleware;
}

const defaultRateLimiter = createRateLimiter();

module.exports = {
  createRateLimiter,
  defaultRateLimiter
};
