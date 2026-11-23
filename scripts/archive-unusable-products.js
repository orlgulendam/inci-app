// scripts/archive-unusable-products.js
// Hiçbir şekilde kullanılamayan ürün kayıtlarını `products` koleksiyonundan
// `products_archive` koleksiyonuna TAŞIR (silmez).
//
// Kriter: kaydın HİÇBİR dilde ürün adı YOK **ve** hiçbir alanda içerik (INCI) metni YOK.
// Bu kayıtlar ne isimle aranabilir ne analiz edilebilir; barkodla bulunsalar bile
// kullanıcıya "İsimsiz Ürün" ve boş analizden başka bir şey sunmaz.
//
// NEDEN "gıda ayıklama" YAPILMIYOR:
// Open Beauty Facts kayıtları Open Food Facts ile aynı şemayı paylaşıyor; bu yüzden
// `nova_group`, `nutriscore_grade`, `nutriments`, `pnns_groups_*` alanları gerçek
// kozmetik ürünlerde de dolu/artık değerlerle bulunuyor. Örnekleme ile doğrulandı:
// bu sinyalle seçilen 20 kaydın 20'si kozmetikti (shampoo, CeraVe nemlendirici,
// diş macunu, duş jeli...) ve 1.977 kayıt hem "gıda" sinyali hem açık kozmetik
// kategori etiketi taşıyor. Bu veri setinde güvenilir bir gıda/kozmetik ayırt edicisi
// YOK; o yüzden böyle bir ayıklama yapılmamalı.
//
// Kullanım:
//   node scripts/archive-unusable-products.js --dry-run   (sadece raporlar)
//   node scripts/archive-unusable-products.js             (taşır)
//   node scripts/archive-unusable-products.js --rollback  (arşivi geri yükler)

const { MongoClient } = require("mongodb");
const config = require("../src/core/config/env");

const DRY_RUN = process.argv.includes("--dry-run");
const ROLLBACK = process.argv.includes("--rollback");
const ARCHIVE = "products_archive";
const BATCH = 1000;

const HAS_NAME = {
  $or: [
    { product_name: { $exists: true, $nin: [null, ""] } },
    { product_name_tr: { $exists: true, $nin: [null, ""] } },
    { product_name_en: { $exists: true, $nin: [null, ""] } },
    { product_name_fr: { $exists: true, $nin: [null, ""] } }
  ]
};

const HAS_INGREDIENTS = {
  $or: [
    { raw_ingredients_text: { $exists: true, $nin: [null, ""] } },
    { ingredients_text: { $exists: true, $nin: [null, ""] } },
    { ingredients_text_tr: { $exists: true, $nin: [null, ""] } },
    { ingredients_text_en: { $exists: true, $nin: [null, ""] } },
    { ingredients_text_fr: { $exists: true, $nin: [null, ""] } },
    { ingredients_text_with_allergens: { $exists: true, $nin: [null, ""] } },
    { "ingredients.0": { $exists: true } }
  ]
};

// Ne adı ne içeriği olan kayıtlar
const UNUSABLE = { $and: [{ $nor: [HAS_NAME] }, { $nor: [HAS_INGREDIENTS] }] };

async function rollback(db) {
  const archive = db.collection(ARCHIVE);
  const products = db.collection("products");

  const count = await archive.countDocuments();
  console.log(`Arşivde ${count} kayıt var, 'products' koleksiyonuna geri yükleniyor...`);
  if (count === 0) return;

  let moved = 0;
  while (true) {
    const docs = await archive.find({}).limit(BATCH).toArray();
    if (docs.length === 0) break;
    await products.insertMany(docs, { ordered: false }).catch((e) => {
      if (e.code !== 11000) throw e; // zaten mevcut olanları yoksay
    });
    await archive.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    moved += docs.length;
    console.log(`  ${moved}/${count}`);
  }
  console.log("\nGeri yükleme tamamlandı.");
  console.log("  products:", await products.estimatedDocumentCount());
  console.log("  arşiv   :", await archive.countDocuments());
}

(async () => {
  const client = await MongoClient.connect(config.mongo.uri);
  const db = client.db(config.mongo.dbName);
  const products = db.collection("products");
  const archive = db.collection(ARCHIVE);

  if (ROLLBACK) {
    await rollback(db);
    await client.close();
    return;
  }

  const total = await products.estimatedDocumentCount();
  const unusable = await products.countDocuments(UNUSABLE);
  const named = await products.countDocuments(HAS_NAME);
  const withIng = await products.countDocuments(HAS_INGREDIENTS);
  const usable = await products.countDocuments({ $and: [HAS_NAME, HAS_INGREDIENTS] });

  console.log("=== MEVCUT DURUM ===");
  console.log("  toplam ürün                    :", total);
  console.log("  adı olan                       :", named);
  console.log("  içeriği olan                   :", withIng);
  console.log("  hem adı hem içeriği (tam)      :", usable);
  console.log("\n=== ARŞİVLENECEK (ne adı ne içeriği var) ===");
  console.log("  sayı                           :", unusable, `(${((unusable / total) * 100).toFixed(1)}%)`);
  console.log("  işlem sonrası kalacak          :", total - unusable);
  console.log("  arşivde zaten bulunan          :", await archive.countDocuments());

  console.log("\n  örnekler:");
  for (const d of await products.aggregate([{ $match: UNUSABLE }, { $sample: { size: 5 } }]).toArray()) {
    console.log(`    barkod=${d.barcode || d.code || "?"} marka=${d.brand_name || d.brands || "-"} (ad ve içerik yok)`);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: hiçbir değişiklik yapılmadı.");
    await client.close();
    return;
  }

  if (unusable === 0) {
    console.log("\nArşivlenecek kayıt yok.");
    await client.close();
    return;
  }

  console.log("\nTaşınıyor (önce arşive kopyala, doğrula, sonra sil)...");
  let moved = 0;
  while (true) {
    const docs = await products.find(UNUSABLE).limit(BATCH).toArray();
    if (docs.length === 0) break;

    await archive.insertMany(docs, { ordered: false }).catch((e) => {
      if (e.code !== 11000) throw e; // tekrar çalıştırmada çakışmayı yoksay
    });

    // Kopyalandığı doğrulanmadan silme yapılmaz
    const ids = docs.map((d) => d._id);
    const copied = await archive.countDocuments({ _id: { $in: ids } });
    if (copied !== docs.length) {
      throw new Error(`Güvenlik durdurması: ${docs.length} kayıt kopyalanacaktı, arşivde ${copied} bulundu. Silme yapılmadı.`);
    }

    await products.deleteMany({ _id: { $in: ids } });
    moved += docs.length;
    if (moved % 5000 === 0 || docs.length < BATCH) {
      console.log(`  ${moved}/${unusable}`);
    }
  }

  console.log("\n=== DOĞRULAMA ===");
  console.log("  products koleksiyonu :", await products.estimatedDocumentCount());
  console.log("  products_archive     :", await archive.countDocuments());
  console.log("  kalan kullanılamaz   :", await products.countDocuments(UNUSABLE));
  console.log("\nGeri almak için: node scripts/archive-unusable-products.js --rollback");

  await client.close();
  console.log("\nTamamlandı.");
})().catch((err) => {
  console.error("HATA:", err.message);
  process.exit(1);
});
