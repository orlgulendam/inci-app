const { MongoClient } = require("mongodb");
const fs = require("fs");

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

const stripParens = s => s.replace(/\([^)]*\)/g, " ");

// Virgül/noktalı virgülle böl, parantez içindeki virgülü bölme
function splitList(text) {
  const parts = [];
  let depth = 0, cur = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    // "1,2-hexanediol" gibi rakam,rakam virgülünü bölme
    const chemComma = ch === "," && /\d/.test(text[i - 1] || "") && /\d/.test(text[i + 1] || "");
    if ((ch === "," || ch === ";" || ch === "•" || ch === "·") && depth === 0 && !chemComma) {
      parts.push(cur); cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

const HEADER = /^\s*(ingredients?|ingr[eé]dients?|inhaltsstoffe|zutaten|ingredientes|ingredi[eë]nten|ingredienti|i[cç]indekiler)\s*(list)?\s*[:：.-]?\s*/i;
const PREFIX = /^\s*(may contain|peut contenir|kann enthalten|\+\/-|\+-)\s*[:：]?\s*/i;

(async () => {
  const client = await MongoClient.connect("mongodb://localhost:27017");
  const col = client.db("obf").collection("products");

  const cursor = col.find(
    { "ingredients.0": { $exists: true } },
    { projection: {
        lc: 1, countries_tags: 1, "ingredients.text": 1,
        ingredients_text: 1, ingredients_text_en: 1, ingredients_text_fr: 1,
        ingredients_text_de: 1, ingredients_text_es: 1, ingredients_text_nl: 1,
        ingredients_text_tr: 1
    } }
  );

  const map = new Map();
  let products = 0, trProducts = 0, rawUsed = 0, fallbackUsed = 0;

  for await (const doc of cursor) {
    products++;
    const isTR = (doc.countries_tags || []).includes("en:turkey");
    if (isTR) trProducts++;

    let text = doc["ingredients_text_" + doc.lc] || doc.ingredients_text || doc.ingredients_text_en;
    if (typeof text === "string" && text.trim().length > 3) {
      rawUsed++;
    } else {
      text = (doc.ingredients || []).map(i => i.text).filter(t => typeof t === "string").join(", ");
      fallbackUsed++;
    }
        text = text
      .replace(/&quot;|&#34;/g, " ").replace(/&amp;/g, "&")
      .replace(HEADER, "")
      .replace(/\s*(may contain|peut contenir|kann enthalten|\+\/-)\s*:?\s*/gi, ",");

    const seen = new Set();
    for (const part of splitList(text)) {
      const raw = part.replace(PREFIX, "").replace(/\s+/g, " ").trim();
      const key = norm(stripParens(raw));
      if (key.length < 3 || key.length > 80 || /^\d+$/.test(key) || seen.has(key)) continue;
      seen.add(key);

      let e = map.get(key);
      if (!e) { e = { count: 0, trCount: 0, forms: new Map(), langs: new Map() }; map.set(key, e); }
      e.count++;
      if (isTR) e.trCount++;
      const f = raw.toLowerCase();
      e.forms.set(f, (e.forms.get(f) || 0) + 1);
      e.langs.set(doc.lc, (e.langs.get(doc.lc) || 0) + 1);
    }
  }

  const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(x => x[0]);

  const out = [...map.entries()]
    .filter(([, e]) => e.count >= 3 || e.trCount >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, e]) => ({
      key, count: e.count, trCount: e.trCount,
      forms: top(e.forms, 4), langs: top(e.langs, 3)
    }));

  fs.writeFileSync("data/freq.json", JSON.stringify(out, null, 1));
  console.log("ürün:", products, "| Türkiye:", trProducts);
  console.log("ham metin kullanılan ürün:", rawUsed, "| yedek (dizi) kullanılan:", fallbackUsed);
  console.log("benzersiz anahtar:", map.size, "| yazılan:", out.length);
  console.log(out.slice(0, 15).map(o => `${o.count}\t${o.trCount}\t${o.key}`).join("\n"));
  await client.close();
})();