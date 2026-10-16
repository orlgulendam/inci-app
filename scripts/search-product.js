// scripts/search-product.js
// MongoDB'deki ürünleri marka veya ürün adına göre arar ve içerik analizini çalıştırır
// Kullanım: node scripts/search-product.js "Nivea" veya node scripts/search-product.js "Elidor"
const { MongoClient } = require("mongodb");
const { analyze } = require("./analyze-product.js");

(async () => {
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.log('Kullanım: node scripts/search-product.js "Marka veya Ürün Adı"');
    process.exit(0);
  }

  const client = await MongoClient.connect("mongodb://localhost:27017");
  const col = client.db("obf").collection("products");

  const regex = new RegExp(query, "i");
  const docs = await col.find({
    $or: [{ brands: regex }, { product_name: regex }, { product_name_tr: regex }, { product_name_en: regex }],
    ingredients_text: { $exists: true, $ne: "" }
  }, {
    projection: {
      _id: 1,
      code: 1,
      brands: 1,
      product_name: 1,
      product_name_tr: 1,
      ingredients_text: 1,
      ingredients_text_tr: 1,
      countries_tags: 1
    }
  }).limit(5).toArray();

  if (!docs.length) {
    console.log(`"${query}" ile eşleşen ve içerik listesi olan ürün bulunamadı.`);
    await client.close();
    return;
  }

  console.log(`\n=== "${query}" İÇİN BULUNAN ${docs.length} ÖRNEK ÜRÜN ===\n`);

  for (const doc of docs) {
    const name = doc.product_name_tr || doc.product_name || "İsimsiz Ürün";
    const brand = doc.brands || "Bilinmiyor";
    const text = doc.ingredients_text_tr || doc.ingredients_text || "";

    console.log(`📌 Ürün: ${name} (${brand}) [Barkod: ${doc.code || doc._id}]`);
    const analysis = analyze(text);

    console.log(`   - Toplam İçerik: ${analysis.total} (Eşleşen: ${analysis.matched})`);
    console.log(`   - 🚫 Yasaklı (Ek II): ${analysis.banned.length ? analysis.banned.map(x => x.name).join(", ") : "Yok (Temiz)"}`);
    console.log(`   - ⚠️ Kısıtlı (Ek III): ${analysis.restricted.length ? analysis.restricted.map(x => x.name).join(", ") : "Yok"}`);
    console.log(`   - 🌸 Alerjen (Ek III): ${analysis.allergens.length ? analysis.allergens.map(x => x.name).join(", ") : "Yok"}`);
    console.log(`   - 🛡️ Koruyucu (Ek V): ${analysis.preservatives.length ? analysis.preservatives.map(x => x.name).join(", ") : "Yok"}`);
    console.log(`   - ☀️ UV Filtresi (Ek VI): ${analysis.uvFilters.length ? analysis.uvFilters.map(x => x.name).join(", ") : "Yok"}`);
    console.log("------------------------------------------------------------\n");
  }

  await client.close();
})();
