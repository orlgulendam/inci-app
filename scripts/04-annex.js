// scripts/04-annex.js
// Ek III-VI (annex3.txt) -> giriş bazlı ayıklama -> tüm AB Sözlüğü (30.418) ve ürün taslağı (3.308) ile eşleştirme -> bayraklar
// Çalıştır:  node scripts/04-annex.js
const fs = require("fs");

const ANNEX_FILE = process.argv[2] || "data/annex3.txt";
const GLOSSARY_FILE = process.argv[3] || "data/glossary.json";
const DRAFT_FILE = process.argv[4] || "data/ingredients.draft.json";
const OUT_DIR = process.argv[5] || "data";

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// ---------- 1) Dosyayı oku, bölümlere ayır ----------
const raw = fs.readFileSync(ANNEX_FILE, "utf8").split(/\r?\n/);
const lines = raw.map(l => l.replace(/ /g, " ").trim());   // boşlukları normalize et

const idx = name => lines.findIndex(l => l === name);
const bounds = {
  III: idx("ANNEX III"), IV: idx("ANNEX IV"), V: idx("ANNEX V"),
  VI: idx("ANNEX VI"), VII: idx("ANNEX VII")
};
for (const [k, v] of Object.entries(bounds)) {
  if (v < 0) { console.error("Bölüm bulunamadı: ANNEX " + k); process.exit(1); }
}

const FOOTNOTE = /^(?:►[MC]\d+\s+)?\(\d{1,2}\)$/;       // "(1)" dipnot başlangıcı
const REF = /^(?:►[MC]\d+\s+)?(\d{1,3})([a-z])?(?:\s*◄)?$/;

function parseSection(startIdx, endIdx) {
  // Dipnot bloğu başladığında tablo biter
  let end = endIdx;
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (FOOTNOTE.test(lines[i])) { end = i; break; }
  }

  const entries = [];
  let cur = null, lastBase = 0, lastSuf = "";
  for (let i = startIdx + 1; i < end; i++) {
    const l = lines[i];
    if (!l || l.startsWith("▼")) continue;
    const m = REF.exec(l);
    if (m) {
      const base = +m[1], suf = m[2] || "";
      const ok = entries.length === 0
        ? base <= 3
        : (base > lastBase && base <= lastBase + 12) || (base === lastBase && suf > lastSuf);
      if (ok) {
        cur = { ref: base + suf, cells: [] };
        entries.push(cur);
        lastBase = base; lastSuf = suf;
        continue;
      }
    }
    if (cur) cur.cells.push(l.replace(/►M\d+\s*|◄/g, "").trim());
  }
  return entries.filter(e => e.cells.length > 0);
}

const sections = {
  III: parseSection(bounds.III, bounds.IV),
  IV: parseSection(bounds.IV, bounds.V),
  V: parseSection(bounds.V, bounds.VI),
  VI: parseSection(bounds.VI, bounds.VII)
};

// ---------- 2) Tam AB Sözlüğü (30.418 Madde) ----------
const glossary = JSON.parse(fs.readFileSync(GLOSSARY_FILE, "utf8"));
const byKey = new Map();
for (const g of glossary) {
  g.id = g.key.replace(/ /g, "-");
  byKey.set(g.key, g);
}

const STOP = new Set([
  "red", "yellow", "blue", "green", "orange", "violet", "black", "white", "brown",
  "soap", "toothpaste", "mouthwash", "shampoo", "deodorants", "general use", "professional use"
]);

function candidateNames(cell) {
  const out = new Set();
  const c = cell.replace(/\s*\(\d{1,2}\)/g, "").trim();     // "(38)" gibi dipnot imlerini temizle
  const push = s => {
    const k = norm(s);
    if (k.length >= 3 && !STOP.has(k)) out.add(k);
  };
  push(c);

  // Çoklu isimleri akıllıca ayır:
  // Hücre uzunluğu çok büyük değilse ve şart cümlesiyle başlamıyorsa
  if (c.length < 300 && !/^[—–-]/.test(c)) {
    // 1) Noktalı virgül (;) veya Taksim (/) ile ayrılmış isimler (örn: "Pinus Mugo Leaf Oil; Pinus Mugo Twig Oil", "Potassium hydroxide/sodium hydroxide")
    if (c.includes(";") || c.includes("/")) {
      c.split(/[;\/]/).map(s => s.trim()).forEach(push);
    }
    // 2) ' + ' ile bağlı bileşik boyalar (örn: "HC Red No 10 + HC Red No 11")
    if (c.includes(" + ")) {
      c.split(" + ").map(s => s.trim()).forEach(push);
    }
    // 3) Düz isim listelerinde virgül (,) ve 'and' (örn: "Picramic Acid and Sodium Picramate")
    // Koşul cümlelerini (pH, maximum, contains vb.) ayırmaktan kaçın
    const isPlain = !/\b(pH|max|level|only|must|shall|contains|preparation|exceed)\b/i.test(c);
    if (isPlain) {
      if (c.includes(", ")) c.split(", ").map(s => s.trim()).forEach(push);
      if (/\band\b/i.test(c)) c.split(/\band\b/i).map(s => s.trim()).forEach(push);
    }
  }
  return out;
}

function matchEntry(entry, annex) {
  const hit = new Map();                                     // id -> glossary item
  for (const cell of entry.cells) {
    for (const k of candidateNames(cell)) {
      const it = byKey.get(k);
      if (it) hit.set(it.id, it);
    }
    if (annex === "IV" && /^\d{5}$/.test(cell)) {            // 5 haneli renk indeksi (örn: 19140 -> CI 19140)
      const it = byKey.get("ci " + cell);
      if (it) hit.set(it.id, it);
    }
  }
  return [...hit.values()];
}

// ---------- 3) Ek III: alerjen etiketi ve kısıtlama ayrımı ----------
const LABEL_LINE = /shall be indicated|must be indicated|referred to in Article 19|^[—-]\s*0,0?01\s*%/i;
const RESTRICT = /\d\s*%|ppm|mg\/kg|μg|pH\b|peroxide value|not to be used|professional use|purposes other than|maximum|level of|purity|impurit|only for|only in|must not exceed|shall not|\bkeep\b|avoid contact|children under|^contains\b/i;

function classifyAnnex3(entry) {
  const text = entry.cells.join("\n");
  const allergen = /(shall|must) be indicated[\s\S]{0,60}in the list of ingredients/i.test(text);
  const rest = entry.cells.filter(c => !LABEL_LINE.test(c) && !/^(or|Oral products)$/i.test(c));
  // CAS/EC satırları ve adlar kısıtlama sayılmasın: sadece RESTRICT desenine uyanlar
  const restricted = rest.some(c => RESTRICT.test(c) && !/^\d{2,7}-\d{2}-\d$/.test(c));
  return { allergen, restricted };
}

// ---------- 4) Eşleştir, bayrakları topla ----------
const flags = {};                // id -> { annex3:[], annex4:[], annex5:[], annex6:[] }
const review = [];
const unmatchedA3 = [];
const get = id => (flags[id] ||= { annex3: [], annex4: [], annex5: [], annex6: [] });

for (const [annex, entries] of Object.entries(sections)) {
  for (const e of entries) {
    const items = matchEntry(e, annex);
    const first = e.cells[0]?.slice(0, 90) || "";
    if (!items.length) {
      if (annex === "III") unmatchedA3.push(`#${e.ref}  ${first}`);
      continue;
    }
    if (annex === "III") {
      const c = classifyAnnex3(e);
      for (const it of items) get(it.id).annex3.push({ ref: e.ref, ...c });
      review.push(`ANNEX III  #${e.ref}  allergen=${c.allergen} restricted=${c.restricted}  <- ${items.map(i => i.name).join(" | ")}   [${first}]`);
    } else {
      const slot = { IV: "annex4", V: "annex5", VI: "annex6" }[annex];
      for (const it of items) get(it.id)[slot].push(e.ref);
      review.push(`ANNEX ${annex}  #${e.ref}  <- ${items.map(i => i.name).join(" | ")}   [${first}]`);
    }
  }
}

// ---------- 5) Bayrakları dosyalara uygula ----------
// A) Tam AB Sözlüğüne (30.418 Madde) bayrakları işle:
for (const g of glossary) {
  const f = flags[g.id];
  g.flags = {
    banned: null,
    restricted: !!(f && f.annex3.some(x => x.restricted)),
    allergen: !!(f && f.annex3.some(x => x.allergen))
  };
  g.eu_annex = f ? {
    annex3: f.annex3.map(x => x.ref),
    colorant: f.annex4, preservative: f.annex5, uv_filter: f.annex6
  } : null;
}
fs.writeFileSync(`${OUT_DIR}/glossary.flagged.json`, JSON.stringify(glossary, null, 1));

// B) Ürün Taslağına (3.308 Madde) bayrakları işle:
const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, "utf8"));
for (const it of draft) {
  const f = flags[it.id];
  it.flags = it.flags || {};
  it.flags.restricted = !!(f && f.annex3.some(x => x.restricted));
  it.flags.allergen = !!(f && f.annex3.some(x => x.allergen));
  it.eu_annex = f ? {
    annex3: f.annex3.map(x => x.ref),
    colorant: f.annex4, preservative: f.annex5, uv_filter: f.annex6
  } : null;
}
fs.writeFileSync(`${OUT_DIR}/ingredients.flagged.json`, JSON.stringify(draft, null, 1));

// C) Denetim ve Bayrak Dosyaları
fs.writeFileSync(`${OUT_DIR}/annex-flags.json`, JSON.stringify(flags, null, 1));
fs.writeFileSync(`${OUT_DIR}/annex-review.txt`, review.join("\n"));
fs.writeFileSync(`${OUT_DIR}/annex3-unmatched.txt`, unmatchedA3.join("\n"));

// ---------- 6) Özet Rapor ----------
console.log("=== YÖNETMELİK GİRİŞLERİ ===");
console.log("Giriş sayıları:", Object.fromEntries(Object.entries(sections).map(([k, v]) => [`Ek ${k}`, v.length])));
console.log("Ek III ilk/son ref:", sections.III[0]?.ref, "…", sections.III.at(-1)?.ref);
console.log("Ek III eşleşen giriş:", sections.III.length - unmatchedA3.length, "/", sections.III.length);
console.log("Ek III eşleşmeyen giriş:", unmatchedA3.length, "(data/annex3-unmatched.txt)");

console.log("\n=== TÜM SÖZLÜK (30.418 MADDE) SONUÇLARI ===");
console.log("Sözlükte regülasyona giren toplam madde:", Object.keys(flags).length);
console.log("  - Alerjen:", glossary.filter(g => g.flags.allergen).length);
console.log("  - Kısıtlı:", glossary.filter(g => g.flags.restricted).length);
console.log("  - Renklendirici (Ek IV):", Object.values(flags).filter(f => f.annex4.length).length);
console.log("  - Koruyucu (Ek V):", Object.values(flags).filter(f => f.annex5.length).length);
console.log("  - UV Filtresi (Ek VI):", Object.values(flags).filter(f => f.annex6.length).length);

console.log("\n=== ÜRÜN TASLAĞI (3.308 MADDE) SONUÇLARI ===");
console.log("Ürünlerde regülasyona giren madde:", draft.filter(d => d.eu_annex).length);
console.log("  - Alerjen:", draft.filter(d => d.flags.allergen).length);
console.log("  - Kısıtlı:", draft.filter(d => d.flags.restricted).length);
console.log("  - Renklendirici (Ek IV):", draft.filter(d => d.eu_annex?.colorant?.length).length);
console.log("  - Koruyucu (Ek V):", draft.filter(d => d.eu_annex?.preservative?.length).length);
console.log("  - UV Filtresi (Ek VI):", draft.filter(d => d.eu_annex?.uv_filter?.length).length);