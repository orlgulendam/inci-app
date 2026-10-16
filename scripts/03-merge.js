const fs = require("fs");

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const stripParens = s => s.replace(/\([^)]*\)/g, " ");
const squash = s => s.replace(/ /g, "");

const glossary = JSON.parse(fs.readFileSync("data/glossary.json", "utf8"));
const byKey = new Map(), byStripped = new Map(), bySquash = new Map();
for (const g of glossary) {
  if (!byKey.has(g.key)) byKey.set(g.key, g);
  if (!g.name.trim().startsWith("(") && g.name.includes("(")) {
    const k2 = norm(stripParens(g.name));
    if (k2 && !byStripped.has(k2)) byStripped.set(k2, g);
  }
  const sq = squash(g.key);
  if (!bySquash.has(sq)) bySquash.set(sq, g);
}

const freq = JSON.parse(fs.readFileSync("data/freq.json", "utf8"));
const manual = fs.existsSync("data/manual-map.json")
  ? JSON.parse(fs.readFileSync("data/manual-map.json", "utf8")) : {};

function lookup(k) {
  let g = byKey.get(k);         if (g) return [g, "tam"];
  g = byStripped.get(k);        if (g) return [g, "parantezsiz"];
  g = bySquash.get(squash(k));  if (g) return [g, "bosluksuz"];
  return [null, null];
}

// manual-map hedeflerini doğrula
for (const [from, to] of Object.entries(manual)) {
  if (to && !lookup(to)[0]) console.log(`UYARI: "${from}" -> "${to}" hedefi sözlükte yok`);
}

const fixCL = s => s.replace(/^cl (\d+)/, "ci $1");
const isCI = s => /^ci \d+$/.test(s);

function resolve(f) {
  let k = fixCL(f.key);
  if (k in manual) { if (manual[k] === null) return [null, "yoksay"]; k = manual[k]; }
  let [g, how] = lookup(k);
  if (g) return [g, how];

  // "a/b/c" biçimi: soldaki resmi adı bul, CI numarasını en sona bırak
  const segs = [];
  for (const form of f.forms) {
    for (const seg of form.split("/")) {
      let s = fixCL(norm(stripParens(seg)));
      if (!s) continue;
      if (s in manual && manual[s]) s = manual[s];
      segs.push(s);
    }
  }
  const ordered = [...segs.filter(s => !isCI(s)), ...segs.filter(isCI)];
  for (const s of ordered) {
    [g] = lookup(s);
    if (g) return [g, "slash"];
  }
  return [null, null];
}

const merged = new Map();
const unmatched = [];
const matchedIdx = new Set();
const via = { tam: 0, parantezsiz: 0, bosluksuz: 0, slash: 0, yoksay: 0 };

freq.forEach((f, idx) => {
  const [g, how] = resolve(f);
  if (how === "yoksay") { via.yoksay++; matchedIdx.add(idx); return; }
  if (!g) { unmatched.push(f); return; }
  matchedIdx.add(idx);
  via[how]++;

  let e = merged.get(g.key);
  if (!e) {
    e = {
      id: g.key.replace(/ /g, "-"),
      inci_name: g.name,
      glossary_no: g.n,
      count: 0, trCount: 0,
      synonyms: [],
      functions: [], cas: null,
      flags: { banned: null, restricted: null, allergen: null },
      note_tr: null, note_source: null
    };
    merged.set(g.key, e);
  }
  e.count += f.count;
  e.trCount += f.trCount;
  for (const s of [f.key, ...f.forms]) {
    if (norm(s) !== g.key && !e.synonyms.includes(s) && e.synonyms.length < 6) e.synonyms.push(s);
  }
});

const list = [...merged.values()].sort((a, b) => b.count - a.count);
fs.writeFileSync("data/ingredients.draft.json", JSON.stringify(list, null, 1));
fs.writeFileSync("data/unmatched.json", JSON.stringify(unmatched.slice(0, 500), null, 1));

for (const N of [100, 300, 500, 1000, 2000]) {
  const n = Math.min(N, freq.length);
  let m = 0;
  for (let i = 0; i < n; i++) if (matchedIdx.has(i)) m++;
  console.log(`ilk ${N} içerikten eşleşen: ${m} (%${Math.round(100 * m / n)})`);
}
console.log("eşleşme türü:", via);
console.log("sözlüğe giren:", list.length, "| eşleşmeyen:", unmatched.length);
console.log("\nEn sık eşleşmeyen 60:");
console.log(unmatched.slice(0, 60).map(u => `${u.count}\t${u.trCount}\t${u.key}`).join("\n"));