// scripts/search-test.js
const { MongoClient } = require("mongodb");

async function run() {
  const client = await MongoClient.connect("mongodb://localhost:27017");
  const db = client.db("obf");
  const productsCol = db.collection("products");

  const brandQueries = [
    "Maruderm",
    "Sinoz",
    "Celenes",
    "Bionnex",
    "The Purest Solutions",
    "Cream Co"
  ];

  for (const b of brandQueries) {
    const docs = await productsCol.find({
      $or: [
        { brands: new RegExp(b, "i") },
        { product_name: new RegExp(b, "i") }
      ]
    }).limit(2).toArray();

    console.log("\n========================================");
    console.log("ARAMA: " + b + " (Bulunan örnekler: " + docs.length + ")");
    for (const d of docs) {
      console.log(" * Marka : " + d.brands);
      console.log("   Ürün  : " + (d.product_name_tr || d.product_name));
      console.log("   Barkod: " + d.code);
      console.log("   İçerik: " + (d.ingredients_text || "").slice(0, 80) + "...");
    }
  }

  client.close();
}

run();
