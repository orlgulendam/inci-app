// scripts/test-coverage.js
const { MongoClient } = require("mongodb");
const { analyze } = require("./analyze-product.js");

(async () => {
  const client = await MongoClient.connect("mongodb://localhost:27017");
  const col = client.db("obf").collection("products");

  // 1) Test on 250 completely random products
  const sampleRandom = await col.aggregate([
    { $match: { ingredients_text: { $exists: true, $ne: "" } } },
    { $sample: { size: 250 } },
    { $project: { product_name: 1, brands: 1, ingredients_text: 1 } }
  ]).toArray();

  let totalTokens = 0, matchedTokens = 0, full100 = 0, above90 = 0;
  for (const p of sampleRandom) {
    const res = analyze(p.ingredients_text);
    if (!res.total) continue;
    totalTokens += res.total;
    matchedTokens += res.matched;
    const rate = res.matched / res.total;
    if (res.unknown.length === 0) full100++;
    if (rate >= 0.90) above90++;
  }

  // 2) Test on 100 products from major trusted brands
  const sampleTop = await col.aggregate([
    { $match: { brands: { $in: ["L'Oréal", "Nivea", "Garnier", "Dove", "Neutrogena"] }, ingredients_text: { $exists: true, $ne: "" } } },
    { $sample: { size: 100 } },
    { $project: { product_name: 1, brands: 1, ingredients_text: 1 } }
  ]).toArray();

  let topTotal = 0, topMatched = 0, topFull100 = 0, topAbove90 = 0;
  for (const p of sampleTop) {
    const res = analyze(p.ingredients_text);
    if (!res.total) continue;
    topTotal += res.total;
    topMatched += res.matched;
    const rate = res.matched / res.total;
    if (res.unknown.length === 0) topFull100++;
    if (rate >= 0.90) topAbove90++;
  }

  console.log("=== 1. TEST: 250 RASTGELE ÜRÜN (TÜM VERİTABANI) ===");
  console.log("Toplam Ayrıştırılan İçerik:", totalTokens);
  console.log("Sözlükle Başarıyla Eşleşen İçerik:", matchedTokens);
  console.log("Genel Kapsama Oranı (Token Match Rate):", (matchedTokens / totalTokens * 100).toFixed(2) + "%");
  console.log("%100 Tam Eşleşen Ürün Oranı:", (full100 / sampleRandom.length * 100).toFixed(2) + "%");
  console.log("%90 ve Üzeri Eşleşen Ürün Oranı:", (above90 / sampleRandom.length * 100).toFixed(2) + "%");

  console.log("\n=== 2. TEST: 100 BÜYÜK MARKA ÜRÜNÜ (L'Oréal, Nivea, Garnier, Dove) ===");
  console.log("Toplam Ayrıştırılan İçerik:", topTotal);
  console.log("Sözlükle Başarıyla Eşleşen İçerik:", topMatched);
  console.log("Marka Kapsama Oranı (Match Rate):", (topMatched / topTotal * 100).toFixed(2) + "%");
  console.log("%100 Tam Eşleşen Ürün Oranı:", (topFull100 / sampleTop.length * 100).toFixed(2) + "%");
  console.log("%90 ve Üzeri Eşleşen Ürün Oranı:", (topAbove90 / sampleTop.length * 100).toFixed(2) + "%");

  await client.close();
})();
