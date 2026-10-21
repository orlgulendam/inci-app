// src/core/middlewares/httpCache.js - HTTP Önbellekleme (Cache-Control & ETag) Middleware
// Gerekçe: Sık değişmeyen ürün, marka ve kimyasal sözlük verilerini önbellekleyerek sunucu yükünü ve mobil veri trafiğini azaltmak.

/**
 * HTTP Cache-Control başlıklarını ayarlayan middleware fabrikası.
 * @param {Object} options
 * @param {number} [options.maxAge=3600] - Saniye cinsinden önbellek süresi (varsayılan: 1 saat)
 * @param {number} [options.staleWhileRevalidate=86400] - Arka planda tazeleme süresi (varsayılan: 24 saat)
 * @param {boolean} [options.isPublic=true] - CDN ve ara sunucu önbelleğine izin ver
 */
function httpCache({ maxAge = 3600, staleWhileRevalidate = 86400, isPublic = true } = {}) {
  return (req, res, next) => {
    // Yalnızca güvenli ve idempotent GET/HEAD istekleri önbelleklenebilir
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const visibility = isPublic ? "public" : "private";
    res.setHeader(
      "Cache-Control",
      `${visibility}, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
    );
    res.setHeader("Vary", "Accept-Encoding, Origin");

    next();
  };
}

module.exports = httpCache;
