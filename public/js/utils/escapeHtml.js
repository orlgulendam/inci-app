// public/js/utils/escapeHtml.js - HTML Kaçışlama Yardımcısı (XSS Savunması)
// Gerekçe: Arayüzün birçok yeri kart ve liste üretmek için innerHTML şablonları
// kullanıyor. Kullanıcının yazdığı metin (arama sorgusu, profil adı, dolap ürün
// adı) ve veritabanından gelen metin (80.000 kayıtlık dış kaynaklı katalogdaki
// ürün/marka adları, topluluk katkıları) bu şablonlara kaçışlanmadan giriyordu;
// arama kutusuna yazılan `<img src=x onerror=...>` çalıştırılabiliyordu.
// Helmet yapılandırmasında CSP kapalı olduğu için ikinci bir savunma hattı yok.

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;"
};

/**
 * Bir değeri HTML metin içeriği veya öznitelik değeri olarak güvenle
 * gömülebilecek biçime çevirir.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * URL'leri `src`/`href` özniteliklerinde kullanmadan önce doğrular.
 * `javascript:` ve `data:` şemalarını engeller; ürün görseli adresleri
 * veritabanından geliyor ve doğrudan `<img src="...">` içine konuyor.
 * @param {*} value
 * @returns {string} güvenliyse kaçışlanmış URL, değilse boş metin
 */
export function safeUrl(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^(https?:|\/)/i.test(raw)) {
    return escapeHtml(raw);
  }
  return "";
}
