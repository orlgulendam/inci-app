// scripts/check-dermo.js
const { MongoClient } = require("mongodb");

async function run() {
  const client = await MongoClient.connect("mongodb://localhost:27017");
  const db = client.db("obf");
  const col = db.collection("products");

  const dermoBrands = [
    "Bioderma",
    "La Roche-Posay",
    "CeraVe",
    "Avene",
    "Vichy",
    "Babe",
    "Sebamed",
    "Isdin",
    "Dermoskin",
    "The Purest Solutions",
    "Maruderm",
    "Cream Co.",
    "Celenes",
    "Sinoz",
    "Bionnex"
  ];

  console.log("=== DERMOKOZMETİK MARKALARIN KAPSAMI VE DOLULUK ORANI ===");
  for (const b of dermoBrands) {
    const total = await col.countDocuments({ brands: new RegExp(b, "i") });
    const withIng = await col.countDocuments({
      brands: new RegExp(b, "i"),
      ingredients_text: { $exists: true, $ne: "" }
    });
    const pct = total > 0 ? Math.round((withIng / total) * 100) : 0;
    console.log(` * ${b.padEnd(22)}: Toplam: ${String(total).padStart(4)} | İçeriği Dolu: ${String(withIng).padStart(4)} (${pct}%)`);
  }

  // Örnek birkaç kült eczane ürününün durumunu kontrol edelim:
  console.log("\n=== TÜRKİYE'DE EN ÇOK SATILAN 5 ECZANE ÜRÜNÜ KONTROLÜ ===");
  const cultDermo = [
    { name: "Bioderma Sensibio H2O", query: /Sensibio H2O/i },
    { name: "La Roche-Posay Cicaplast Baume B5+", query: /Cicaplast/i },
    { name: "CeraVe Nemlendirici Krem", query: /CeraVe/i },
    { name: "Vichy Mineral 89", query: /Mineral 89/i },
    { name: "Avene Cicalfate+", query: /Cicalfate/i }
  ];

  for (const item of cultDermo) {
    const found = await col.findOne({
      product_name: item.query,
      ingredients_text: { $exists: true, $ne: "" }
    });
    if (found) {
      console.log(`[VAR] ${item.name} -> Barkod: ${found.code} | INCI: ${(found.ingredients_text || "").slice(0, 50)}...`);
    } else {
      console.log(`[YOK / EKSİK] ${item.name}`);
    }
  }

  client.close();
}

run();
