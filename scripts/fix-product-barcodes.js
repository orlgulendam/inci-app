// scripts/fix-product-barcodes.js
// Gerekçe: Sephora ve harici kaynaklardan gelen ve alfasayısal slug'a sahip ürünlerin (örn: sephora_clinique_...)
// deterministik barkodlarını doğrudan MongoDB 'products' dokümanlarına 'barcode' ve 'barcodes' olarak yazar.
// Böylece arama sonuçlarından tıklanan ürünler 404 NOT_FOUND hatası vermeden anında açılır.

const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB_NAME || "obf";

function computeCleanBarcode(doc) {
  const rawBarcode = doc.barcode || doc.code || (doc._id ? String(doc._id) : null);
  if (!rawBarcode) return null;

  let cleanBarcode = String(rawBarcode).replace(/\D/g, "");
  if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
    let hash = 0;
    const seedStr = String(doc.code || doc._id || rawBarcode);
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    cleanBarcode = "20" + String(hash).padStart(10, "0").slice(0, 10);
  }
  return cleanBarcode;
}

async function fixBarcodes() {
  console.log("=== Barkod Eşleştirme ve Düzeltme Başlatılıyor ===");
  const client = await MongoClient.connect(MONGO_URI);
  const col = client.db(DB_NAME).collection("products");

  const cursor = col.find({});
  let total = 0;
  let updated = 0;
  const batch = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    total++;

    const expectedBarcode = computeCleanBarcode(doc);
    if (!expectedBarcode) continue;

    const currentBarcode = doc.barcode;
    const currentBarcodes = Array.isArray(doc.barcodes) ? doc.barcodes : [];

    const needsUpdate = currentBarcode !== expectedBarcode || !currentBarcodes.includes(expectedBarcode);

    if (needsUpdate) {
      const newBarcodes = Array.from(new Set([...currentBarcodes, expectedBarcode, doc.code].filter(Boolean)));
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              barcode: expectedBarcode,
              barcodes: newBarcodes,
              generated_barcode: expectedBarcode
            }
          }
        }
      });
      updated++;
    }

    if (batch.length >= 1000) {
      await col.bulkWrite(batch, { ordered: false });
      batch.length = 0;
      process.stdout.write(`\rİşlenen: ${total} | Güncellenen: ${updated}`);
    }
  }

  if (batch.length > 0) {
    await col.bulkWrite(batch, { ordered: false });
  }

  console.log(`\n-> Tamamlandı! Toplam ${total} üründen ${updated} tanesinin barkodları senkronize edildi.`);
  await col.createIndex({ barcode: 1 });
  await col.createIndex({ barcodes: 1 });
  await col.createIndex({ generated_barcode: 1 });
  console.log("-> Barkod indeksleri güncellendi.");

  await client.close();
}

fixBarcodes().catch(console.error);
