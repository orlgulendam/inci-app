// scripts/analyze-product.js
// Bir ürünün içerik listesini (ham metin / etiket) alır -> ayrıştırır -> sözlük ve regülasyon bayraklarıyla analiz eder
// Kullanım: node scripts/analyze-product.js "data/sample-input.txt" veya node scripts/analyze-product.js "Aqua, Glycerin..."
const fs = require("fs");

const DRAFT_FILE = "data/ingredients.flagged.json";
const GLOSSARY_FILE = "data/glossary.flagged.json";
const MANUAL_MAP = "data/manual-map.json";

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const stripParens = s => s.replace(/\([^)]*\)/g, " ");
const squash = s => s.replace(/ /g, "");

// 1) Veritabanlarını yükle
const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, "utf8"));
const glossary = JSON.parse(fs.readFileSync(GLOSSARY_FILE, "utf8"));
const manual = fs.existsSync(MANUAL_MAP) ? JSON.parse(fs.readFileSync(MANUAL_MAP, "utf8")) : {};

const dbMap = new Map();
// Taslak (öncelikli - ürün sayısı vb. var)
for (const d of draft) dbMap.set(norm(d.inci_name), { ...d, source: "draft" });
// AB Genel Sözlüğü (taslakta olmayanları tamamlar)
for (const g of glossary) {
  const k = norm(g.name);
  if (!dbMap.has(k)) {
    dbMap.set(k, {
      id: g.id,
      inci_name: g.name,
      glossary_no: g.n,
      flags: g.flags,
      eu_annex: g.eu_annex,
      functions: g.functions || [],
      functions_tr: g.functions_tr || [],
      note_tr: g.note_tr || null,
      cas: g.cas || null,
      source: "glossary"
    });
  }
}

// 2) Akıllı liste bölücü (virgül, noktalı virgül, yeni satırları böler; kimyasal virgülleri korur)
function splitIngredients(text) {
  // Markdown linklerini ve dipnotları temizle (örn: [[1](https://...)])
  let cleanText = text.replace(/\[\s*\[\s*\d+\s*\]\s*\([^)]*\)\s*\]/g, "")
                      .replace(/\[\s*\+\s*\/\s*-\s*:?/g, "") // "[+/-" temizle
                      .replace(/[\[\]]/g, "");              // köşeli parantezleri temizle

  const parts = [];
  let depth = 0, cur = "";
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);

    // "1,2-hexanediol" gibi kimyasal rakam,rakam virgülünü koru
    const chemComma = ch === "," && /\d/.test(cleanText[i - 1] || "") && /\d/.test(cleanText[i + 1] || "");
    // Yüzde parantezleri içindeki virgülleri de bölme
    const isDelimiter = (ch === "," || ch === ";" || ch === "•" || ch === "·" || ch === "\n" || ch === "\r") && depth === 0 && !chemComma;

    if (isDelimiter) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// 3) Madde Çözümleyici (INCI eşleştirme)
function resolveItem(raw) {
  let clean = raw
    .replace(/^\s*(ingredients?|inhaltsstoffe|içindekiler|zutaten)\s*:?\s*/i, "")
    .replace(/^\s*(may contain|\+\/-|\+-)\s*:?\s*/i, "")
    .replace(/\s*\(\s*%\s*\d+(?:[.,]\d+)?\s*\)/g, "") // "(%7.50)"
    .replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*%\s*\)/g, "") // "(7.50%)"
    .replace(/\s+\d+(?:[.,]\d+)?\s*%/g, "")           // " 7.50%"
    .replace(/\s+/g, " ").trim();

  if (!clean || clean.length < 2) return null;

  // manual-map kontrolü
  const kClean = norm(clean);
  if (kClean in manual && manual[kClean]) {
    const target = manual[kClean];
    const hit = dbMap.get(target);
    if (hit) return { raw, clean, match: hit, how: "manual_map" };
  }

  // 1. Doğrudan tam ad
  let hit = dbMap.get(kClean);
  if (hit) return { raw, clean, match: hit, how: "tam" };

  // 2. Parantezsiz ad (örn: "Hordeum Vulgare (Barley) Extract" -> "Hordeum Vulgare Extract")
  // Parantez içi İngilizce/açıklama adı olabilir:
  const pMatch = clean.match(/^([^(]+)\s*\(([^)]+)\)\s*(.*)$/);
  if (pMatch) {
    const before = pMatch[1].trim(), inside = pMatch[2].trim(), after = pMatch[3].trim();
    // Deneme A: Dıştaki kelimeleri birleştir (Hordeum Vulgare + Extract)
    const combinedOuter = norm((before + " " + after).trim());
    hit = dbMap.get(combinedOuter);
    if (hit) return { raw, clean, match: hit, how: "parantez_disi" };

    // Deneme B: Parantez içindeki kelime (örn: "Water (Aqua)" -> Aqua)
    hit = dbMap.get(norm(inside));
    if (hit) return { raw, clean, match: hit, how: "parantez_ici" };
  }

  // 3. Slash parçalama (örn: "Water / Aqua / Eau")
  if (clean.includes("/")) {
    for (const seg of clean.split("/")) {
      const s = norm(seg);
      if (s in manual && manual[s]) {
        hit = dbMap.get(manual[s]);
        if (hit) return { raw, clean, match: hit, how: "slash_manual" };
      }
      hit = dbMap.get(s);
      if (hit) return { raw, clean, match: hit, how: "slash" };
    }
  }

  // 4. Renk kodları (CI xxxxx)
  const ciMatch = clean.match(/\bci\s*(\d{5})\b/i);
  if (ciMatch) {
    hit = dbMap.get("ci " + ciMatch[1]);
    if (hit) return { raw, clean, match: hit, how: "ci_kodu" };
  }

  // 5. Boşluksuz eşleşme
  const sq = squash(kClean);
  for (const [k, v] of dbMap.entries()) {
    if (squash(k) === sq) return { raw, clean, match: v, how: "bosluksuz" };
  }

  return { raw, clean, match: null, how: "bulunamadi" };
}

function analyze(rawText) {
  // Çoklu CI içeren maddeleri önceden ayır (örn: "Iron Oxides (Ci 77491, Ci 77492, Ci 77499)")
  // Eğer parantez içinde virgülle ayrılmış birden fazla CI varsa, bunları aç
  let processedText = rawText.replace(/\(([^)]*ci\s*\d{5}[^)]*)\)/gi, (m, inside) => {
    return "(" + inside.replace(/,/g, ";") + ")"; // virgülden koru veya ayır
  });

  const rawTokens = splitIngredients(processedText);
  const items = [];
  const banned = [];
  const restricted = [];
  const allergens = [];
  const preservatives = [];
  const colorants = [];
  const uvFilters = [];
  const unknown = [];

  // Parantez içi birden çok CI olanları alt maddelere böl
  const expandedTokens = [];
  for (const tok of rawTokens) {
    const ciList = tok.match(/ci\s*\d{5}/gi);
    if (ciList && ciList.length > 1) {
      for (const ci of ciList) expandedTokens.push(ci.toUpperCase());
    } else {
      expandedTokens.push(tok);
    }
  }

  for (const tok of expandedTokens) {
    const res = resolveItem(tok);
    if (!res) continue;
    items.push(res);

    if (!res.match) {
      unknown.push(res.raw);
      continue;
    }

    const m = res.match;
    const f = m.flags || {};
    const ann = m.eu_annex || {};

    if (f.banned) banned.push({ name: m.inci_name, raw: res.raw, ref: ann.annex2 });
    if (f.restricted) restricted.push({ name: m.inci_name, raw: res.raw, ref: ann.annex3 });
    if (f.allergen) allergens.push({ name: m.inci_name, raw: res.raw, ref: ann.annex3 });
    if (ann.preservative && ann.preservative.length) preservatives.push({ name: m.inci_name, raw: res.raw, ref: ann.preservative });
    if (ann.colorant && ann.colorant.length) colorants.push({ name: m.inci_name, raw: res.raw, ref: ann.colorant });
    if (ann.uv_filter && ann.uv_filter.length) uvFilters.push({ name: m.inci_name, raw: res.raw, ref: ann.uv_filter });
  }

  return {
    total: expandedTokens.length,
    matched: expandedTokens.length - unknown.length,
    banned,
    restricted,
    allergens,
    preservatives,
    colorants,
    uvFilters,
    unknown,
    items
  };
}

// Komut satırından çağrıldığında
if (require.main === module) {
  let input = process.argv.slice(2).join(" ");
  if (fs.existsSync(input)) input = fs.readFileSync(input, "utf8");
  if (!input) {
    console.log('Kullanım: node scripts/analyze-product.js "Aqua, Glycerin, Limonene" veya dosya yolu');
    process.exit(0);
  }
  const res = analyze(input);
  console.log(JSON.stringify(res, null, 2));
}

module.exports = { analyze, splitIngredients, resolveItem };
