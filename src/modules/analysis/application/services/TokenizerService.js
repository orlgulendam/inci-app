// src/modules/analysis/application/services/TokenizerService.js - Kimyasal Metin Ayrıştırma Servisi (SRP)
// Tek sorumluluğu: Kozmetik etiket metnini kimyasal virgülleri bozmadan atomik maddelere bölmektir.

class TokenizerService {
  static cleanHeaderAndNoise(text) {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/^\s*(ingredients?|inhaltsstoffe|içindekiler|zutaten)\s*:?\s*/i, "")
      .replace(/^\s*(may contain|\+\/-|\+-)\s*:?\s*/i, "")
      .replace(/\[\s*\[\s*\d+\s*\]\s*\([^)]*\)\s*\]/g, "") // Markdown dipnotları
      .replace(/\[\s*\+\s*\/\s*-\s*:?/g, "")
      .replace(/[\[\]]/g, "")
      .trim();
  }

  static split(rawText) {
    const text = TokenizerService.cleanHeaderAndNoise(rawText);
    if (!text) return [];

    // Çoklu CI içeren parantezleri virgülden koru
    const processedText = text.replace(/\(([^)]*ci\s*\d{5}[^)]*)\)/gi, (_, inside) => {
      return "(" + inside.replace(/,/g, ";") + ")";
    });

    const parts = [];
    let depth = 0;
    let cur = "";

    for (let i = 0; i < processedText.length; i++) {
      const ch = processedText[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);

      // "1,2-hexanediol" gibi kimyasal rakam,rakam virgülünü koru
      const prev = processedText[i - 1] || "";
      const next = processedText[i + 1] || "";
      const isChemComma = ch === "," && /\d/.test(prev) && /\d/.test(next);

      const isDelimiter =
        (ch === "," || ch === ";" || ch === "•" || ch === "·" || ch === "\n" || ch === "\r") &&
        depth === 0 &&
        !isChemComma;

      if (isDelimiter) {
        if (cur.trim()) parts.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }

    if (cur.trim()) parts.push(cur.trim());

    // Parantez içi birden çok CI olanları alt maddelere aç
    const expanded = [];
    for (const item of parts) {
      const ciList = item.match(/ci\s*\d{5}/gi);
      if (ciList && ciList.length > 1) {
        for (const ci of ciList) expanded.push(ci.toUpperCase());
      } else {
        expanded.push(item);
      }
    }

    return expanded.filter(t => t.length > 1);
  }

  static cleanToken(rawToken) {
    return rawToken
      .replace(/\s*\(\s*%\s*\d+(?:[.,]\d+)?\s*\)/g, "") // "(%7.50)"
      .replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*%\s*\)/g, "") // "(7.50%)"
      .replace(/\s+\d+(?:[.,]\d+)?\s*%/g, "")           // " 7.50%"
      .replace(/\s+/g, " ")
      .trim();
  }
}

module.exports = TokenizerService;
