// scripts/migrate-architecture.js
// INCI Engine & Kozmetik Analiz Platformu: MongoDB Mimari Geçiş (Migration) Script'i
// 1. ingredients (30.000+ INCI kimyasalı) koleksiyonunu oluşturur ve indeksler
// 2. brands koleksiyonunu ürünlerden derleyip oluşturur ve indeksler
// 3. users, product_contributions, scan_logs koleksiyonlarını ve TTL indeksini oluşturur
// 4. products koleksiyonundaki ürünleri brand_id ile bağlar, barkod indekslerini ve metin indeksini kurar
// 5. JSON Schema Doğrulayıcılarını (Validators) aktif hale getirir

const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
const { analyze } = require("./analyze-product.js");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function run() {
  console.log("==================================================================");
  console.log("🚀 MONGODB KURUMSAL MİMARİ GEÇİŞİ (MIGRATION) BAŞLATILIYOR");
  console.log("==================================================================");

  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db("obf");

  // ==================================================================
  // ADIM 1: INGREDIENTS (INCI Kimyasal Sözlüğü) Koleksiyonu
  // ==================================================================
  console.log("\n[1/5] 'ingredients' (INCI Sözlüğü & AB Mevzuatı) koleksiyonu hazırlanıyor...");
  const glossaryFile = path.join(__dirname, "..", "data", "glossary.flagged.json");
  if (!fs.existsSync(glossaryFile)) {
    throw new Error("data/glossary.flagged.json dosyası bulunamadı!");
  }

  const glossaryRaw = JSON.parse(fs.readFileSync(glossaryFile, "utf8"));
  console.log(`-> Toplam ${glossaryRaw.length} adet ham INCI bileşeni okundu.`);

  // Tekilleştirme
  const ingMap = new Map();
  for (const g of glossaryRaw) {
    const key = (g.key || g.name.toLowerCase()).trim();
    if (!key) continue;

    if (!ingMap.has(key)) {
      ingMap.set(key, {
        inci_name: g.name.trim(),
        normalized_name: key,
        cas_number: g.cas || null,
        ec_number: g.ec || null,
        functions_tr: Array.isArray(g.functions_tr) ? g.functions_tr : [],
        description_tr: g.note_tr || null,
        comedogenic_rating: null,
        irritancy_rating: null,
        flags: {
          is_banned: !!(g.flags && g.flags.banned),
          is_restricted: !!(g.flags && g.flags.restricted),
          is_allergen: !!(g.flags && g.flags.allergen),
          is_preservative: !!(g.flags && g.flags.preservative),
          is_colorant: !!(g.flags && g.flags.colorant),
          is_uv_filter: !!(g.flags && g.flags.uvFilter),
          annex_notes: g.eu_annex ? `Annex: ${g.eu_annex}` : null
        },
        updated_at: new Date()
      });
    } else {
      // Varsa bayrakları birleştir
      const existing = ingMap.get(key);
      if (g.flags) {
        if (g.flags.banned) existing.flags.is_banned = true;
        if (g.flags.restricted) existing.flags.is_restricted = true;
        if (g.flags.allergen) existing.flags.is_allergen = true;
      }
    }
  }

  const ingredientsDocs = Array.from(ingMap.values());
  const ingredientsCol = db.collection("ingredients");

  // Varsa eskiyi temizle ve toplu ekle
  await ingredientsCol.deleteMany({});
  const chunkSize = 5000;
  for (let i = 0; i < ingredientsDocs.length; i += chunkSize) {
    const chunk = ingredientsDocs.slice(i, i + chunkSize);
    await ingredientsCol.insertMany(chunk);
  }
  console.log(`-> ${ingredientsDocs.length} tekil INCI kimyasalı başarıyla kaydedildi.`);

  // İndeksler
  await ingredientsCol.createIndex({ normalized_name: 1 }, { unique: true, name: "idx_ingredients_normalized_unique" });
  await ingredientsCol.createIndex({ cas_number: 1 }, { sparse: true, name: "idx_ingredients_cas" });
  await ingredientsCol.createIndex({ "flags.is_banned": 1, "flags.is_allergen": 1 }, { name: "idx_ingredients_safety_flags" });
  console.log("-> 'ingredients' indeksleri oluşturuldu.");

  // ==================================================================
  // ADIM 2: BRANDS Koleksiyonu
  // ==================================================================
  console.log("\n[2/5] 'brands' koleksiyonu ürünlerden derleniyor...");
  const productsCol = db.collection("products");
  const rawBrands = await productsCol.distinct("brands");
  const brandsCol = db.collection("brands");

  const brandMap = new Map();
  const slugCounts = new Map();

  for (const b of rawBrands) {
    if (!b || typeof b !== "string") continue;
    const cleanBrand = b.trim();
    if (cleanBrand.length < 2 || cleanBrand.toLowerCase() === "undefined" || cleanBrand.toLowerCase() === "genel") continue;

    let slug = slugify(cleanBrand);
    if (!slug) slug = "brand-" + Math.floor(Math.random() * 10000);

    if (slugCounts.has(slug)) {
      const cnt = slugCounts.get(slug) + 1;
      slugCounts.set(slug, cnt);
      slug = `${slug}-${cnt}`;
    } else {
      slugCounts.set(slug, 1);
    }

    const verifiedBrands = [
      "The Purest Solutions", "Maruderm", "Cream Co.", "Celenes", "Celenes by Sweden",
      "Sinoz", "Bionnex", "Bioderma", "La Roche-Posay", "CeraVe", "Avene", "Vichy",
      "Maybelline", "Maybelline New York", "L'Oréal", "L'Oréal Paris", "Flormar", "Pastel",
      "Golden Rose", "Dermoskin", "Sebamed", "Isdin", "Babe", "NARS", "Rare Beauty"
    ];

    const isVerified = verifiedBrands.some(vb => vb.toLowerCase() === cleanBrand.toLowerCase());

    const brandDoc = {
      name: cleanBrand,
      slug: slug,
      origin_country: isVerified ? "TR" : null,
      website: null,
      verified: isVerified,
      created_at: new Date()
    };

    brandMap.set(cleanBrand.toLowerCase(), brandDoc);
  }

  await brandsCol.deleteMany({});
  const brandList = Array.from(brandMap.values());
  for (let i = 0; i < brandList.length; i += 5000) {
    await brandsCol.insertMany(brandList.slice(i, i + 5000));
  }
  console.log(`-> ${brandList.length} adet marka 'brands' koleksiyonuna aktarıldı.`);

  await brandsCol.createIndex({ slug: 1 }, { unique: true, name: "idx_brands_slug_unique" });
  await brandsCol.createIndex({ name: 1 }, { name: "idx_brands_name" });
  console.log("-> 'brands' indeksleri oluşturuldu.");

  // Hızlı ID eşleştirmesi için brandIdMap oluştur
  const dbBrands = await brandsCol.find({}).project({ _id: 1, name: 1 }).toArray();
  const brandIdMap = new Map();
  for (const dbb of dbBrands) {
    brandIdMap.set(dbb.name.toLowerCase(), dbb._id);
  }

  // ==================================================================
  // ADIM 3: USERS, PRODUCT_CONTRIBUTIONS, SCAN_LOGS Koleksiyonları
  // ==================================================================
  console.log("\n[3/5] 'users', 'product_contributions', 'scan_logs' koleksiyonları hazırlanıyor...");
  
  const usersCol = db.collection("users");
  await usersCol.createIndex({ email: 1 }, { unique: true, name: "idx_users_email_unique" });

  const contributionsCol = db.collection("product_contributions");
  await contributionsCol.createIndex({ barcode: 1, status: 1 }, { name: "idx_contributions_barcode_status" });
  await contributionsCol.createIndex({ user_id: 1 }, { name: "idx_contributions_user" });

  const scanLogsCol = db.collection("scan_logs");
  // 90 Günlük TTL İndeksi
  await scanLogsCol.createIndex({ scanned_at: 1 }, { expireAfterSeconds: 7776000, name: "idx_scan_logs_ttl_90d" });
  console.log("-> Yardımcı koleksiyonlar ve TTL (90 gün) indeksi oluşturuldu.");

  // ==================================================================
  // ADIM 4: PRODUCTS Koleksiyonunun Zenginleştirilmesi ve İndeksleri
  // ==================================================================
  console.log("\n[4/5] 'products' koleksiyonu güncelleniyor ve indeksleniyor...");
  
  // A) Mükerrer Barkodları Temizleme (Deduplication)
  console.log("-> OBF'den kalan mükerrer barkodlu kayıtlar tekilleştiriliyor...");
  try {
    await productsCol.dropIndex("idx_products_barcode_unique");
  } catch (e) {}

  const dups = await productsCol.aggregate([
    { $match: { code: { $exists: true, $ne: null, $ne: "" } } },
    { $group: { _id: "$code", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  for (const d of dups) {
    const docs = await productsCol.find({ _id: { $in: d.ids } }).toArray();
    docs.sort((a, b) => {
      const aScore = (a.is_verified || a.verified ? 1000 : 0) + (a.ingredients_text || "").length;
      const bScore = (b.is_verified || b.verified ? 1000 : 0) + (b.ingredients_text || "").length;
      return bScore - aScore;
    });
    const toDelete = docs.slice(1).map(x => x._id);
    if (toDelete.length > 0) {
      await productsCol.deleteMany({ _id: { $in: toDelete } });
    }
  }

  // B) İndeksler
  async function safeCreateIndex(keys, options) {
    try {
      await productsCol.createIndex(keys, options);
    } catch (e) {
      if (e.code !== 85) console.warn("İndeks uyarısı:", e.message);
    }
  }

  await safeCreateIndex({ barcode: 1 }, { unique: true, sparse: true, name: "idx_products_barcode_unique" });
  await safeCreateIndex({ barcodes: 1 }, { name: "barcodes_1" });
  await safeCreateIndex({ brand_id: 1, category: 1 }, { name: "idx_products_brand_cat" });
  await safeCreateIndex({ "safety_summary.is_clean": 1, category: 1 }, { name: "idx_products_clean_category" });
  await safeCreateIndex(
    { product_name: "text", brand_name: "text" },
    { default_language: "turkish", name: "idx_products_text_search" }
  );
  console.log("-> 'products' bileşik, tekil ve Full-Text arama indeksleri kuruldu.");

  // B) Popüler ve doğrulanmış ürünlerde brand_id, barcodes ve güvenlik özetini bağla
  console.log("-> Popüler ürünlerde brand_id ve güvenlik özetleri zenginleştiriliyor...");
  const verifiedCursor = productsCol.find({
    $or: [
      { verified: true },
      { is_verified: true },
      { source: { $exists: true } },
      { code: /^86[89]/ }
    ]
  });

  let enrichedCount = 0;
  while (await verifiedCursor.hasNext()) {
    const doc = await verifiedCursor.next();
    const brandStr = (doc.brands || "").toLowerCase().trim();
    const brandId = brandIdMap.get(brandStr) || null;
    const barcodeStr = doc.code || String(doc._id);

    const barcodesArr = Array.isArray(doc.barcodes) && doc.barcodes.length > 0 
      ? Array.from(new Set([barcodeStr, ...doc.barcodes])) 
      : [barcodeStr];

    const updates = {
      barcode: barcodeStr,
      barcodes: barcodesArr,
      brand_name: doc.brands || "Genel",
      brand_id: brandId,
      is_verified: true,
      updated_at: new Date()
    };

    // İçerik analizi özeti yoksa üret
    if (doc.ingredients_text && doc.ingredients_text.length > 3 && !doc.safety_summary) {
      try {
        const analysis = analyze(doc.ingredients_text);
        updates.ingredients_count = analysis.total;
        updates.safety_summary = {
          is_clean: analysis.banned.length === 0,
          banned_count: analysis.banned.length,
          restricted_count: analysis.restricted.length,
          allergen_count: analysis.allergens.length
        };
        updates.ingredients_summary = analysis.items.slice(0, 30).map((it, idx) => ({
          order: idx + 1,
          raw_name: it.raw,
          inci_name: it.match ? it.match.inci_name : null,
          is_banned: !!(it.match && it.match.flags && it.match.flags.banned),
          is_restricted: !!(it.match && it.match.flags && it.match.flags.restricted),
          is_allergen: !!(it.match && it.match.flags && it.match.flags.allergen),
          primary_function_tr: (it.match && it.match.functions_tr && it.match.functions_tr[0]) || null
        }));
      } catch (err) {}
    }

    await productsCol.updateOne({ _id: doc._id }, { $set: updates });
    enrichedCount++;
  }
  console.log(`-> ${enrichedCount} adet popüler ürün yeni şema standartlarına göre zenginleştirildi.`);

  // ==================================================================
  // ADIM 5: JSON Schema Validator Tanımları (collMod - Moderate)
  // ==================================================================
  console.log("\n[5/5] Koleksiyonlar için JSON Schema Validator kuralları uygulanıyor...");

  try {
    await db.command({
      collMod: "ingredients",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["inci_name", "normalized_name", "flags"],
          properties: {
            inci_name: { bsonType: "string" },
            normalized_name: { bsonType: "string" },
            cas_number: { bsonType: ["string", "null"] },
            functions_tr: { bsonType: "array" }
          }
        }
      },
      validationLevel: "moderate"
    });

    await db.command({
      collMod: "brands",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["name", "slug"],
          properties: {
            name: { bsonType: "string" },
            slug: { bsonType: "string" }
          }
        }
      },
      validationLevel: "moderate"
    });

    await db.command({
      collMod: "products",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["product_name"],
          properties: {
            product_name: { bsonType: "string" },
            barcode: { bsonType: ["string", "null"] },
            brand_name: { bsonType: ["string", "null"] }
          }
        }
      },
      validationLevel: "moderate"
    });

    console.log("-> JSON Schema Validator kuralları 'moderate' seviyesinde başarıyla bağlandı.");
  } catch (err) {
    console.warn("Validator uygulama uyarısı:", err.message);
  }

  // Özet
  console.log("\n==================================================================");
  console.log("✅ MİMARİ GEÇİŞ BAŞARIYLA TAMAMLANDI!");
  console.log("==================================================================");
  console.log(`- 'products' koleksiyonu : ${await productsCol.estimatedDocumentCount()} ürün`);
  console.log(`- 'ingredients' sözlüğü   : ${await ingredientsCol.estimatedDocumentCount()} INCI kimyasalı`);
  console.log(`- 'brands' koleksiyonu    : ${await brandsCol.estimatedDocumentCount()} marka`);
  console.log(`- 'users' koleksiyonu     : Aktif & İndeksli`);
  console.log(`- 'scan_logs' TTL         : 90 gün otomatik imha devrede`);
  console.log("==================================================================");

  client.close();
}

run().catch(err => {
  console.error("Migration kritik hatası:", err);
  process.exit(1);
});
