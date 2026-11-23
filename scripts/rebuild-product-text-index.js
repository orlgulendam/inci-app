// scripts/rebuild-product-text-index.js
// products koleksiyonunun tam metin indeksini daha geniş alan kümesiyle yeniden kurar.
//
// Sorun: Mevcut idx_products_text_search yalnızca `brand_name` + `product_name` alanlarını kapsıyor.
// Alan doluluk oranları:
//   brand_name       %4,7   (3.751)      <- indeksli
//   brands          %56,7   (45.250)     <- indeksli DEĞİL
//   product_name      %67   (53.451)     <- indeksli
//   product_name_tr  %6,2   (4.977)      <- indeksli DEĞİL
//   product_name_en %29,4   (23.460)     <- indeksli DEĞİL
// Bu yüzden markası yalnızca `brands` alanında olan on binlerce ürün aramada hiç çıkmıyor.
//
// MongoDB koleksiyon başına YALNIZCA BİR metin indeksine izin verir; bu yüzden eski indeks
// düşürülüp yenisi kurulur. Kurulum sırasında arama, repository'deki önek (prefix) katmanına
// düşer; sonuç döner ama yavaşlar.
//
// Geri alma (eski tanım):
//   db.products.dropIndex("idx_products_text_search")
//   db.products.createIndex(
//     { brand_name: "text", product_name: "text" },
//     { name: "idx_products_text_search", default_language: "turkish", weights: { brand_name: 1, product_name: 1 } }
//   )
//
// Kullanım:
//   node scripts/rebuild-product-text-index.js --dry-run
//   node scripts/rebuild-product-text-index.js

const { MongoClient } = require("mongodb");
const config = require("../src/core/config/env");

const DRY_RUN = process.argv.includes("--dry-run");
const INDEX_NAME = "idx_products_text_search";

// Marka eşleşmesi ürün adı eşleşmesinden daha güçlü bir sinyal; ağırlıkları buna göre veriyoruz.
const FIELDS = {
  brand_name: "text",
  brands: "text",
  product_name: "text",
  product_name_tr: "text",
  product_name_en: "text"
};

const WEIGHTS = {
  brand_name: 4,
  brands: 4,
  product_name: 2,
  product_name_tr: 2,
  product_name_en: 1
};

(async () => {
  const client = await MongoClient.connect(config.mongo.uri);
  const db = client.db(config.mongo.dbName);
  const col = db.collection("products");

  const existing = (await col.indexes()).find((i) => i.name === INDEX_NAME);
  console.log("=== MEVCUT INDEKS ===");
  if (existing) {
    console.log("  ad              :", existing.name);
    console.log("  ağırlıklar      :", JSON.stringify(existing.weights));
    console.log("  varsayılan dil  :", existing.default_language);
  } else {
    console.log("  (metin indeksi yok)");
  }

  console.log("\n=== KURULACAK INDEKS ===");
  console.log("  alanlar         :", Object.keys(FIELDS).join(", "));
  console.log("  ağırlıklar      :", JSON.stringify(WEIGHTS));
  console.log("  varsayılan dil  : turkish");

  if (DRY_RUN) {
    console.log("\n--dry-run: hiçbir değişiklik yapılmadı.");
    await client.close();
    return;
  }

  if (existing) {
    console.log(`\n'${INDEX_NAME}' düşürülüyor...`);
    await col.dropIndex(INDEX_NAME);
    console.log("  düşürüldü.");
  }

  console.log("Yeni metin indeksi kuruluyor (79.821 doküman)...");
  const started = Date.now();
  await col.createIndex(FIELDS, {
    name: INDEX_NAME,
    default_language: "turkish",
    language_override: "language",
    weights: WEIGHTS
  });
  console.log(`  kuruldu (${Date.now() - started} ms).`);

  const created = (await col.indexes()).find((i) => i.name === INDEX_NAME);
  console.log("\n=== DOĞRULAMA ===");
  console.log("  ağırlıklar:", JSON.stringify(created.weights));

  // Daha önce yalnızca `brands` alanında markası olan ürünler artık bulunabiliyor mu?
  for (const q of ["nivea", "garnier", "cerave", "la roche posay", "nemlendirici"]) {
    const t = Date.now();
    const docs = await col
      .find({ $text: { $search: q } })
      .project({ score: { $meta: "textScore" }, brand_name: 1, brands: 1, product_name: 1 })
      .sort({ score: { $meta: "textScore" } })
      .limit(3)
      .toArray();
    const total = await col.countDocuments({ $text: { $search: q } }, { limit: 10000 });
    console.log(`\n  "${q}" -> ${total} sonuç (${Date.now() - t} ms)`);
    docs.forEach((d) =>
      console.log(`     ${d.score.toFixed(2)} | ${d.brand_name || d.brands || "?"} | ${(d.product_name || "").slice(0, 52)}`)
    );
  }

  await client.close();
  console.log("\nTamamlandı.");
})().catch((err) => {
  console.error("HATA:", err);
  process.exit(1);
});
