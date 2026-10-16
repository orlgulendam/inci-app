// scripts/list-brands.js
const { MongoClient } = require("mongodb");

(async () => {
  const client = await MongoClient.connect("mongodb://localhost:27017");
  const col = client.db("obf").collection("products");

  const brandCounts = new Map();
  const trBrandCounts = new Map();
  let totalWithBrand = 0;

  const cursor = col.find({}, { projection: { brands: 1, countries_tags: 1 } });
  for await (const doc of cursor) {
    if (!doc.brands) continue;
    const isTR = (doc.countries_tags || []).includes("en:turkey");
    const rawBrands = doc.brands.split(",").map(b => b.trim()).filter(Boolean);
    if (rawBrands.length) totalWithBrand++;

    for (const b of rawBrands) {
      brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
      if (isTR) {
        trBrandCounts.set(b, (trBrandCounts.get(b) || 0) + 1);
      }
    }
  }

  const topGlobal = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  const topTR = [...trBrandCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);

  console.log("=== TOP GLOBAL BRANDS ===");
  topGlobal.forEach(([b, c], i) => console.log(`${i + 1}. ${b} (${c} ürün)`));

  console.log("\n=== TOP TURKEY BRANDS ===");
  topTR.forEach(([b, c], i) => console.log(`${i + 1}. ${b} (${c} ürün)`));

  console.log(`\nToplam benzersiz marka: ${brandCounts.size}`);
  console.log(`Markası olan ürün sayısı: ${totalWithBrand}`);

  await client.close();
})();
