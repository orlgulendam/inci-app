// src/core/utils/apiResponse.js - REST API Standart Yanıt ve Sparse Fieldsets Yardımcısı
// Gerekçe: Over-fetching sorununu çözmek (Sparse Fieldsets) ve tutarlı yanıt zarfı (Envelope) üretmek için.

/**
 * Nesneden yalnızca talep edilen alanları ayıklar (Sparse Fieldsets).
 * @param {Object|Array} data - Tekil nesne veya nesne dizisi
 * @param {string|string[]} fields - Virgülle ayrılmış alan listesi (örn: "barcode,productName")
 * @returns {Object|Array} Yalnızca seçili alanları içeren filtrelenmiş veri
 */
function pickFields(data, fields) {
  if (!data || !fields) return data;

  const fieldList = Array.isArray(fields)
    ? fields
    : String(fields)
        .split(",")
        .map(f => f.trim())
        .filter(Boolean);

  if (fieldList.length === 0) return data;

  const pickSingle = (item) => {
    if (!item || typeof item !== "object") return item;
    const filtered = {};
    for (const key of fieldList) {
      if (key in item) {
        filtered[key] = item[key];
      }
    }
    return filtered;
  };

  if (Array.isArray(data)) {
    return data.map(pickSingle);
  }

  return pickSingle(data);
}

/**
 * Standart RESTful sayfalama meta verisi oluşturur.
 * @param {Object} params
 * @param {number} params.total - Toplam kayıt sayısı
 * @param {number} params.page - Mevcut sayfa numarası
 * @param {number} params.limit - Sayfa başına kayıt limiti
 * @returns {Object} Standart meta nesnesi
 */
function buildPaginationMeta({ total = 0, page = 1, limit = 20 } = {}) {
  const safeTotal = Math.max(0, parseInt(total, 10) || 0);
  const safeLimit = Math.max(1, parseInt(limit, 10) || 20);
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const totalPages = Math.ceil(safeTotal / safeLimit) || (safeTotal === 0 ? 0 : 1);

  return {
    total: safeTotal,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1 && safePage <= totalPages + 1
  };
}

/**
 * Standart RESTful başarı yanıt zarfı oluşturur.
 * @param {Object|Array} data - Döndürülecek veri
 * @param {Object} options
 * @param {Object} [options.meta] - Sayfalama veya ek meta veriler
 * @param {string|string[]} [options.fields] - Sparse fieldsets filtresi
 * @returns {Object} { success: true, data, meta }
 */
function formatSuccessResponse(data, { meta = null, fields = null } = {}) {
  const finalData = fields ? pickFields(data, fields) : data;
  const response = {
    success: true,
    data: finalData
  };

  if (meta) {
    response.meta = meta;
  }

  return response;
}

module.exports = {
  pickFields,
  buildPaginationMeta,
  formatSuccessResponse
};
