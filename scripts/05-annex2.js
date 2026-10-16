// scripts/05-annex2.js
// Ek II (Yasaklı Maddeler - Prohibited Substances) -> CSV + CMR Omnibus güncellemeleri -> Sözlük ve Ürün Taslağı eşleştirme -> flags.banned
// Çalıştır:  node scripts/05-annex2.js
const fs = require("fs");

const ANNEX2_CSV = process.argv[2] || "data/annex2.csv";
const GLOSSARY_FILE = process.argv[3] || "data/glossary.flagged.json";
const DRAFT_FILE = process.argv[4] || "data/ingredients.flagged.json";
const FLAGS_FILE = "data/annex-flags.json";
const OUT_DIR = "data";

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// ---------- 1) CSV Ayrıştırıcı (Tırnak ve yeni satır güvenli) ----------
function parseCSV(text) {
  const rows = [];
  let cur = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field.trim()); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(field.trim());
        if (cur.some(Boolean)) rows.push(cur);
        cur = []; field = "";
      } else field += ch;
    }
  }
  if (field || cur.length) { cur.push(field.trim()); rows.push(cur); }
  return rows;
}

// ---------- 2) Ek II Ana Verisini Yükle ----------
const csvRaw = fs.readFileSync(ANNEX2_CSV, "utf8");
const csvRows = parseCSV(csvRaw);
const header = csvRows[0];
const baseEntries = [];

for (let i = 1; i < csvRows.length; i++) {
  const r = csvRows[i];
  if (!r || !r[0]) continue;
  baseEntries.push({
    ref: r[0].trim(),
    chem_name: r[1] || "",
    cas: r[2] || "",
    ec: r[3] || "",
    ident: r[9] || ""
  });
}

// ---------- 3) Modern CMR Omnibus Ek II Güncellemeleri (#1379 - #1710) ----------
// AB 1223/2009 Yönetmeliğine son yıllarda (2019-2024) eklenen ve kozmetik formülasyonlarında geçmişte kullanılmış kritik yasaklılar:
const omnibusEntries = [
  { ref: "1380", chem_name: "3- and 4-(4-Hydroxy-4-methylpentyl) cyclohex-3-ene-1-carbaldehyde (HICC / Lyral)", ident: "HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE" },
  { ref: "1381", chem_name: "2,6-Dihydroxy-4-methyl-benzaldehyde (atranol)", ident: "ATRANOL" },
  { ref: "1382", chem_name: "3-Chloro-2,6-Dihydroxy-4-methyl-benzaldehyde (chloroatranol)", ident: "CHLOROATRANOL" },
  { ref: "1388", chem_name: "Octamethylcyclotetrasiloxane (D4)", ident: "CYCLOTETRASILOXANE" },
  { ref: "1657", chem_name: "4-[(tetrahydro-2H-pyran-2-yl)oxy]phenol (deoxyarbutin)", ident: "DEOXYARBUTIN" },
  { ref: "1658", chem_name: "Tagetes erecta flower extract and flower oil", ident: "TAGETES ERECTA FLOWER EXTRACT; TAGETES ERECTA FLOWER OIL" },
  { ref: "1666", chem_name: "2-(4-tert-Butylbenzyl)propionaldehyde (Lilial / BMHCA)", ident: "BUTYLPHENYL METHYLPROPIONAL" },
  { ref: "1669", chem_name: "Sodium N-(hydroxymethyl)glycinate", ident: "SODIUM HYDROXYMETHYLGLYCINATE" },
  { ref: "1670", chem_name: "Pyrithione zinc (Zinc pyrithione)", ident: "ZINC PYRITHIONE" },
  { ref: "1687", chem_name: "4-Methylpentan-2-one (isobutyl methyl ketone, MIBK)", ident: "ISOBUTYL METHYL KETONE" },
  { ref: "1695", chem_name: "2-Ethylhexanoic acid and its salts", ident: "ETHYLHEXANOIC ACID" },
  { ref: "1703", chem_name: "4-Methylbenzylidene camphor (4-MBC / Enzacamene)", ident: "4-METHYLBENZYLIDENE CAMPHOR" }
];

const allEntries = [...baseEntries, ...omnibusEntries];

// ---------- 4) Sözlük ve Taslak Yükleme ----------
const glossary = JSON.parse(fs.readFileSync(GLOSSARY_FILE, "utf8"));
const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, "utf8"));
const flags = fs.existsSync(FLAGS_FILE) ? JSON.parse(fs.readFileSync(FLAGS_FILE, "utf8")) : {};

const gMap = new Map();
for (const g of glossary) gMap.set(g.key, g);

const dMap = new Map();
for (const d of draft) dMap.set(norm(d.inci_name), d);

// ---------- 5) Eşleştirme ve İstisna Yönetimi ----------
const bannedGlossary = new Map(); // g.id -> { ref, name, chem_name }
const bannedDraft = new Map();    // d.id -> { ref, name, chem_name, count }

for (const entry of allEntries) {
  const chemLower = entry.chem_name.toLowerCase();

  // Yasal İstisna Kontrolleri (False-Positive Önleme):
  // 1) "except for normal content in natural essences" (örn: Furocoumarins - doğal turunçgil yağları yasaklı değildir)
  const isEssenceExcept = chemLower.includes("natural essences") || chemLower.includes("normal content");
  // 2) "except if the full refining history is known" (örn: Saflaştırılmış kozmetik Vazelin yasaklı değildir)
  const isRefiningExcept = chemLower.includes("refining history");
  // 3) DMSO extract şartı (C15-19 Alkane gibi saflaştırılmış hidrokarbonlar yasaklı değildir)
  const isPetroleumDistillateExcept = chemLower.includes("dmso extract");
  // 4) İncir yaprağı esansı yasağı (meyve ekstreleri yasaklı değildir)
  const isFigLeafExcept = chemLower.includes("fig leaf absolute");

  const candidates = new Set();
  candidates.add(entry.chem_name);

  if (entry.ident) {
    for (const part of entry.ident.split(";")) {
      const clean = part.replace(/\(\*\)/g, "").trim();
      if (clean) candidates.add(clean);
    }
  }

  for (const cand of candidates) {
    const k = norm(cand);
    if (!k || k.length < 3) continue;

    // İstisna filtreleri:
    if (isEssenceExcept && (k.includes("extract") || k.includes("oil") || k.includes("juice") || k.includes("peel") || k.includes("fruit"))) continue;
    if (isRefiningExcept && k.includes("petrolatum")) continue;
    if (isPetroleumDistillateExcept && (k.includes("alkane") || k.includes("distillate"))) continue;
    if (isFigLeafExcept && !k.includes("leaf")) continue;

    // Sözlük eşleşmesi
    const g = gMap.get(k);
    if (g) {
      if (!bannedGlossary.has(g.id)) {
        bannedGlossary.set(g.id, { ref: entry.ref, name: g.name, chem_name: entry.chem_name });
      }
    }

    // Ürün taslağı eşleşmesi
    const d = dMap.get(k);
    if (d) {
      if (!bannedDraft.has(d.id)) {
        bannedDraft.set(d.id, { ref: entry.ref, name: d.inci_name, chem_name: entry.chem_name, count: d.count });
      }
    }
  }
}

// ---------- 6) Bayrakları Uygula ----------
// A) Tam AB Sözlüğüne (30.418 Madde) uygula
for (const g of glossary) {
  g.flags = g.flags || {};
  const isBanned = bannedGlossary.has(g.id);
  g.flags.banned = isBanned;

  if (isBanned) {
    const b = bannedGlossary.get(g.id);
    g.eu_annex = g.eu_annex || { annex3: [], colorant: [], preservative: [], uv_filter: [] };
    g.eu_annex.annex2 = g.eu_annex.annex2 || [];
    if (!g.eu_annex.annex2.includes(b.ref)) g.eu_annex.annex2.push(b.ref);

    // Genel bayrak haritasını da güncelle
    flags[g.id] = flags[g.id] || { annex3: [], annex4: [], annex5: [], annex6: [] };
    flags[g.id].annex2 = flags[g.id].annex2 || [];
    if (!flags[g.id].annex2.includes(b.ref)) flags[g.id].annex2.push(b.ref);
  } else {
    if (g.eu_annex) g.eu_annex.annex2 = g.eu_annex.annex2 || [];
  }
}
fs.writeFileSync(`${OUT_DIR}/glossary.flagged.json`, JSON.stringify(glossary, null, 1));

// B) Ürün Taslağına (3.308 Madde) uygula
for (const it of draft) {
  it.flags = it.flags || {};
  const isBanned = bannedDraft.has(it.id);
  it.flags.banned = isBanned;

  if (isBanned) {
    const b = bannedDraft.get(it.id);
    it.eu_annex = it.eu_annex || { annex3: [], colorant: [], preservative: [], uv_filter: [] };
    it.eu_annex.annex2 = it.eu_annex.annex2 || [];
    if (!it.eu_annex.annex2.includes(b.ref)) it.eu_annex.annex2.push(b.ref);
  } else {
    if (it.eu_annex) it.eu_annex.annex2 = it.eu_annex.annex2 || [];
  }
}
fs.writeFileSync(`${OUT_DIR}/ingredients.flagged.json`, JSON.stringify(draft, null, 1));
fs.writeFileSync(`${OUT_DIR}/annex-flags.json`, JSON.stringify(flags, null, 1));

// ---------- 7) Denetim Raporu Yaz ----------
const reviewLines = [
  "=== EK II (YASAKLI MADDELER) DENETİM RAPORU ===",
  `Toplam Ek II Kaydı: ${allEntries.length} (Temel: ${baseEntries.length} + Omnibus CMR: ${omnibusEntries.length})`,
  `Sözlükte Yasaklı Olarak İşaretlenen: ${bannedGlossary.size} madde`,
  `Ürünlerinizde Geçen Yasaklı Madde: ${bannedDraft.size} madde\n`,
  "--- ÜRÜNLERİNİZDE TESPİT EDİLEN YASAKLI İÇERİKLER ---"
];

for (const [id, info] of bannedDraft.entries()) {
  reviewLines.push(`[ÜRÜN İÇERİĞİ] ${info.name.padEnd(45)} | Ürün Sayısı: ${String(info.count).padStart(4)} | Ek II Ref: #${info.ref} (${info.chem_name.slice(0, 70)})`);
}

reviewLines.push("\n--- SÖZLÜKTEKİ DİĞER ÖRNEK YASAKLI MADDELER ---");
let shown = 0;
for (const [id, info] of bannedGlossary.entries()) {
  if (bannedDraft.has(id)) continue;
  if (++shown > 30) break;
  reviewLines.push(`[AB SÖZLÜK]  ${info.name.padEnd(45)} | Ek II Ref: #${info.ref} (${info.chem_name.slice(0, 70)})`);
}

fs.writeFileSync(`${OUT_DIR}/annex2-review.txt`, reviewLines.join("\n"));

// ---------- 8) Konsol Özeti ----------
console.log("=== EK II (YASAKLI MADDELER) İŞLEME TAMAMLANDI ===");
console.log("Toplam Ek II girdi sayısı:", allEntries.length);
console.log("Sözlükte (30.418) yasaklı madde:", bannedGlossary.size);
console.log("Ürün taslağında (3.308) tespit edilen yasaklı içerik:", bannedDraft.size);
console.log("\nÜrünlerinizdeki Yasaklı Maddeler:");
for (const [, info] of bannedDraft.entries()) {
  console.log(`  - ${info.name} (Geçiş: ${info.count} ürün, Ek II Ref: #${info.ref})`);
}
console.log("\nRapor dosyası kaydedildi: data/annex2-review.txt");
