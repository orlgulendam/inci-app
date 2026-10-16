// scripts/check-makeup.js
const { MongoClient } = require("mongodb");

async function run() {
  const client = await MongoClient.connect("mongodb://localhost:27017");
  const db = client.db("obf");
  const col = db.collection("products");

  const categories = [
    { name: "Kapatıcı / Concealer", regex: /concealer|kapatıcı|kapatici/i },
    { name: "Aydınlatıcı / Highlighter", regex: /highlighter|aydınlatıcı|aydinlatici/i },
    { name: "Allık / Blush", regex: /blush|allık|allik/i },
    { name: "Fondöten / Foundation", regex: /foundation|fondöten|fondoten/i },
    { name: "BB / CC Krem", regex: /\bbb\b|\bcc\b|bb krem|cc krem/i },
    { name: "Pudra / Powder", regex: /powder|pudra/i }
  ];

  for (const cat of categories) {
    const filter = {
      $or: [
        { product_name: cat.regex },
        { product_name_tr: cat.regex },
        { category: cat.regex }
      ],
      ingredients_text: { $exists: true, $ne: "" }
    };

    const count = await col.countDocuments(filter);
    const samples = await col.find(filter).limit(3).project({
      brands: 1,
      product_name: 1,
      product_name_tr: 1,
      code: 1,
      ingredients_text: 1
    }).toArray();

    console.log(`\n========================================`);
    console.log(`KATEGORİ: ${cat.name} (Toplam: ${count} ürün)`);
    samples.forEach(s => {
      console.log(` * [${s.brands || "Bilinmiyor"}] ${s.product_name_tr || s.product_name}`);
      console.log(`   Barkod: ${s.code}`);
      console.log(`   İçerik : ${(s.ingredients_text || "").slice(0, 75)}...`);
    });
  }

  // Ayrıca popüler makyaj markaları: Maybelline, L'Oreal, Golden Rose, Flormar, Pastel, Revolution
  console.log(`\n========================================`);
  console.log(`POPÜLER MAKYAJ MARKALARI İÇERİK SAYILARI:`);
  for (const b of ["Maybelline", "L'Oréal", "Golden Rose", "Flormar", "Pastel", "Revolution", "NYX", "Essence", "Kiko", "Catrice"]) {
    const c = await col.countDocuments({
      brands: new RegExp(b, "i"),
      ingredients_text: { $exists: true, $ne: "" }
    });
    console.log(` - ${b}: ${c} ürün`);
  }

  client.close();
}

run();
