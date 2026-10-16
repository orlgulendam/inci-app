const fs = require("fs");

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

const all = fs.readFileSync("data/glossary.txt", "utf8")
  .split(/\r?\n/).map(l => l.trim()).filter(Boolean);

// Tablonun başlangıcı: ilk kayıt (20S)-PROTOPANAXADIOL
const start = Math.max(0, all.findIndex(l => /PROTOPANAXADIOL/.test(l)));
const lines = all.slice(start);

const out = [];
let last = 0, i = 0;

// İlk kayıt numarasız gelmiş olabilir
if (!/^\d+$/.test(lines[0])) {
  out.push({ n: 1, name: lines[0], key: norm(lines[0]), blend: /[()\/+]/.test(lines[0]) });
  last = 1; i = 1;
}

for (; i < lines.length - 1; i++) {
  if (!/^\d{1,6}$/.test(lines[i])) continue;
  const n = +lines[i];
  if (n <= last || n > last + 3) continue;       // sıra dışı sayıları atla
  const name = lines[i + 1];
  if (/^\d+$/.test(name)) continue;
  out.push({ n, name, key: norm(name), blend: /[()\/+]/.test(name) });
  last = n;
}

fs.writeFileSync("data/glossary.json", JSON.stringify(out, null, 1));
const blends = out.filter(o => o.blend).length;
console.log("toplam:", out.length, "| karışım adı:", blends, "| tekil:", out.length - blends);
console.log("son numara:", out[out.length - 1]?.n);
console.log("ilk 5:", out.slice(0, 5).map(o => o.name));
console.log("son 5:", out.slice(-5).map(o => o.name));
console.log("örnek:", out.filter(o => o.key === "glycerin" || o.key === "aqua" || o.key === "parfum").map(o => o.n + " " + o.name));