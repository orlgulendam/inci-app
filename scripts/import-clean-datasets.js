// scripts/import-clean-datasets.js
// Hugging Face ve Sephora temiz veri setlerini MongoDB 'products' koleksiyonuna aktarır,
// mevcut Türkiye ürünlerinin isimlerini temizler ve arama indekslerini oluşturur.

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

function cleanText(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
    .trim();
}

function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function run() {
  console.log("=== INCI Engine Veri Seti İyileştirme & Birleştirme Başlatılıyor ===");
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db("obf");
  const productsCol = db.collection("products");

  // 1) Arama Performansı için İndeksleri Oluştur
  console.log("\n1) İndeksler oluşturuluyor...");
  try {
    await productsCol.createIndex({ code: 1 });
    await productsCol.createIndex({ brands: 1 });
    await productsCol.createIndex({ product_name: 1 });
    await productsCol.createIndex({ product_name_tr: 1 });
    await productsCol.createIndex({ "barcodes": 1 });
    console.log("-> İndeksler başarıyla oluşturuldu.");
  } catch (e) {
    console.warn("İndeks uyarısı:", e.message);
  }

  // 2) Hugging Face (thebeautyapi/beautyproducts) verisini içe aktar
  const hfPath = path.join(__dirname, "..", "data", "beauty_data.jsonl");
  let hfCount = 0;
  if (fs.existsSync(hfPath)) {
    console.log("\n2) Hugging Face 'thebeautyapi/beautyproducts' verisi işleniyor...");
    const fileStream = fs.createReadStream(hfPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        const brand = cleanText(item.brand);
        const name = cleanText(item.name);
        if (!name || name.length < 2) continue;

        // Barkodlar: GTIN14'ten EAN13 ve GTIN14 hallerini çıkar
        const barcodes = [];
        if (Array.isArray(item.gtin14)) {
          for (const g of item.gtin14) {
            const cleanG = g.trim();
            if (cleanG.startsWith("0") && cleanG.length === 14) {
              barcodes.push(cleanG.slice(1)); // EAN-13 formatı
            }
            barcodes.push(cleanG);
          }
        }

        // INCI Listesini derle
        const ingList = (item.ingredients || [])
          .map(i => cleanText(i.label_name || i.name))
          .filter(t => t.length > 1);
        const ingText = ingList.join(", ");

        const primaryCode = barcodes.length > 0 ? barcodes[0] : `hf_${item.id}`;

        const doc = {
          code: primaryCode,
          barcodes: barcodes,
          product_name: name,
          product_name_tr: name,
          brands: brand,
          ingredients_text: ingText,
          ingredients_text_tr: ingText,
          category: item.category || "skincare",
          origin: item.origin || null,
          source: "hf_beautyproducts",
          image_url: item.image_name ? `https://huggingface.co/datasets/thebeautyapi/beautyproducts/resolve/main/images/${item.image_name}` : null,
          verified: true,
          updated_at: new Date()
        };

        // Barkod veya isim+marka ile eşleşirse zenginleştir / ekle
        await productsCol.updateOne(
          { $or: [{ code: primaryCode }, { brands: brand, product_name: name }] },
          { $set: doc },
          { upsert: true }
        );
        hfCount++;
      } catch (err) {
        // satır hatasını atla
      }
    }
    console.log(`-> Hugging Face veri setinden ${hfCount} ürün başarıyla eklendi/güncellendi.`);
  }

  // 3) Sephora & Global Skincare CSV verisini içe aktar (cosmetics.csv)
  const sephoraPath = path.join(__dirname, "..", "data", "sephora_cosmetics.csv");
  let sephoraCount = 0;
  if (fs.existsSync(sephoraPath)) {
    console.log("\n3) Sephora Skincare veri seti işleniyor...");
    const content = fs.readFileSync(sephoraPath, "utf8");
    const lines = content.split("\n");
    // Header: Label,Brand,Name,Price,Rank,Ingredients,...
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Basit CSV ayrıştırma (tırnak içindeki virgülleri koru)
      const match = line.match(/^([^,]+),([^,]+),("(?:[^"]|"")*"|[^,]*),([^,]*),([^,]*),("(?:[^"]|"")*"|.*)$/);
      if (!match) continue;

      const category = cleanText(match[1]);
      const brand = cleanText(match[2]);
      let name = cleanText(match[3].replace(/^"|"$/g, "").replace(/""/g, '"'));
      let ingredients = cleanText(match[6].replace(/^"|"$/g, "").replace(/""/g, '"'));

      if (!name || name.length < 2 || !ingredients || ingredients.length < 5) continue;

      const docId = `sephora_${brand.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`.slice(0, 80);

      const doc = {
        code: docId,
        product_name: name,
        product_name_tr: name,
        brands: brand,
        ingredients_text: ingredients,
        ingredients_text_tr: ingredients,
        category: category,
        source: "sephora_skincare",
        verified: true,
        updated_at: new Date()
      };

      await productsCol.updateOne(
        { brands: brand, product_name: name },
        { $set: doc },
        { upsert: true }
      );
      sephoraCount++;
    }
    console.log(`-> Sephora veri setinden ${sephoraCount} ürün başarıyla eklendi/güncellendi.`);
  }

  // 4) Mevcut Türkiye Ürünlerini Temizleme & Normalizasyon
  console.log("\n4) Veritabanındaki yerel (868/869 ve TR) ürünlerin isimleri temizleniyor...");
  const cursor = productsCol.find({
    $or: [
      { code: /^86[89]/ },
      { countries_tags: "en:turkey" }
    ]
  });

  let trCleaned = 0;
  let trRemoved = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    let name = doc.product_name_tr || doc.product_name || "";
    let brand = doc.brands || "";

    // Geçersiz veya boş isimleri temizle / atla
    if (!name || name === "undefined" || name.toLowerCase() === "n/a" || name.trim().length < 2) {
      if (!doc.ingredients_text || doc.ingredients_text.length < 5) {
        // Hem ismi hem içeriği olmayan çöp kayıtları kaldır
        await productsCol.deleteOne({ _id: doc._id });
        trRemoved++;
        continue;
      }
    }

    // Temizleme kuralları
    let cleanName = cleanText(name);
    // Sonundaki virgül veya tireleri sil
    cleanName = cleanName.replace(/[,;:\-\s]+$/, "");

    // Bilinen yazım hatalarını düzelt
    cleanName = cleanName
      .replace(/\bDogal sabum\b/i, "Doğal Sabun")
      .replace(/\bpirinç sabunu\b/i, "Pirinç Sabunu")
      .replace(/\bhamam\b/i, "Hamam Sabunu");

    let cleanBrand = cleanText(brand);
    if (!cleanBrand || cleanBrand === "undefined") {
      // Eğer marka boşsa ve ürün adı bilinen bir markayla başlıyorsa markayı çıkar
      const commonBrands = ["Duru", "Arko", "Farmasi", "Golden Rose", "Flormar", "Difaş", "Dalin", "Evyap", "Eyüp Sabri Tuncer", "Palmolive", "Protex", "Colgate"];
      for (const b of commonBrands) {
        if (cleanName.toLowerCase().startsWith(b.toLowerCase())) {
          cleanBrand = b;
          break;
        }
      }
    }

    // İsmi temizlenen ürünü güncelle
    if (cleanName !== name || cleanBrand !== brand) {
      await productsCol.updateOne(
        { _id: doc._id },
        {
          $set: {
            product_name: cleanName,
            product_name_tr: cleanName,
            brands: cleanBrand || doc.brands || "Genel",
            is_cleaned: true
          }
        }
      );
      trCleaned++;
    }
  }

  console.log(`-> ${trCleaned} yerel ürünün ismi ve markası başarıyla temizlendi.`);
  console.log(`-> ${trRemoved} adet boş/çöp kayıt temizlendi.`);

  const finalTotal = await productsCol.estimatedDocumentCount();
  console.log(`\n=== Tamamlandı! Güncel Toplam Ürün Sayısı: ${finalTotal} ===`);

  client.close();
}

run().catch(err => {
  console.error("Hata:", err);
  process.exit(1);
});
