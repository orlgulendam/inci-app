// server.js - INCI Engine REST API Servisi
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
const { analyze } = require("./scripts/analyze-product.js");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

let db, productsCol;

// MongoDB Bağlantısı
async function initMongo() {
  try {
    const client = await MongoClient.connect(MONGO_URI);
    db = client.db("obf");
    productsCol = db.collection("products");
    console.log("MongoDB obf veritabanina basariyla baglanildi.");
  } catch (err) {
    console.error("MongoDB baglanti hatasi:", err.message);
  }
}

// Yardımcı: Belgeden tüm dillerdeki içerik metnini veya dizisini akıllıca çeker
function extractIngredientsText(doc) {
  if (!doc) return "";
  let text = doc.ingredients_text_tr || 
             (doc.lc && doc["ingredients_text_" + doc.lc]) || 
             doc.ingredients_text || 
             doc.ingredients_text_en || 
             doc.ingredients_text_fr || 
             doc.ingredients_text_with_allergens || "";

  if (typeof text === "string" && text.trim().length > 3) {
    return text.trim();
  }

  if (Array.isArray(doc.ingredients) && doc.ingredients.length > 0) {
    const list = doc.ingredients
      .map(i => (typeof i === "string" ? i : (i && i.text)))
      .filter(t => typeof t === "string" && t.trim().length > 1);
    if (list.length > 0) return list.join(", ");
  }

  return "";
}

// 1) Sağlık Kontrolü (Healthcheck)
app.get("/api/health", async (req, res) => {
  const count = productsCol ? await productsCol.estimatedDocumentCount() : 0;
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    total_products: count,
    engine: "INCI Engine v1.0",
    regulations: "EC No 1223/2009 (Annex II-VI)"
  });
});

// 2) Ürün Arama API'si (İsim veya Marka ile arama)
// Örnek: GET /api/products/search?q=nivea&limit=15
app.get("/api/products/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);

    if (!q || q.length < 2) {
      return res.status(400).json({ error: "Lütfen en az 2 karakterlik arama terimi girin." });
    }

    const regex = new RegExp(q, "i");
    const docs = await productsCol.find({
      $or: [
        { code: q }, // Doğrudan barkod araması
        { barcodes: q },
        { brands: regex },
        { product_name: regex },
        { product_name_tr: regex },
        { product_name_en: regex },
        { product_name_fr: regex }
      ]
    }, {
      projection: {
        _id: 1,
        code: 1,
        brands: 1,
        product_name: 1,
        product_name_tr: 1,
        product_name_en: 1,
        product_name_fr: 1,
        image_url: 1,
        image_front_url: 1,
        image_small_url: 1,
        lc: 1,
        ingredients_text: 1,
        ingredients_text_tr: 1,
        ingredients_text_en: 1,
        ingredients_text_fr: 1,
        ingredients_text_with_allergens: 1,
        "ingredients.text": 1,
        countries_tags: 1
      }
    }).limit(limit * 2).toArray();

    const results = docs.map(doc => {
      const name = doc.product_name_tr || doc.product_name || doc.product_name_en || doc.product_name_fr || "İsimsiz Ürün";
      const brand = doc.brands || "Bilinmeyen Marka";
      const image = doc.image_front_url || doc.image_url || doc.image_small_url || null;
      const rawText = extractIngredientsText(doc);
      const hasIngredients = rawText.length > 3;

      return {
        id: doc._id,
        barcode: doc.code || doc._id,
        name,
        brand,
        image,
        has_ingredients: hasIngredients,
        ingredients_preview: hasIngredients ? rawText.slice(0, 120) + "..." : null
      };
    });

    // İçerik listesi DOLU olanları öncelikli göster
    results.sort((a, b) => (b.has_ingredients ? 1 : 0) - (a.has_ingredients ? 1 : 0));

    res.json({
      query: q,
      count: Math.min(results.length, limit),
      products: results.slice(0, limit)
    });
  } catch (err) {
    console.error("Arama hatasi:", err);
    res.status(500).json({ error: "Ürün arama sırasında bir hata oluştu." });
  }
});

// 3) Barkod / ID ile Ürün Detay ve Analiz API'si
// Örnek: GET /api/products/8682536069403
app.get("/api/products/:barcode", async (req, res) => {
  try {
    const barcode = req.params.barcode.trim();
    const doc = await productsCol.findOne({
      $or: [{ code: barcode }, { _id: barcode }, { barcodes: barcode }]
    });

    if (!doc) {
      return res.status(404).json({ error: "Ürün veritabanında bulunamadı." });
    }

    const name = doc.product_name_tr || doc.product_name || doc.product_name_en || doc.product_name_fr || "İsimsiz Ürün";
    const brand = doc.brands || "Bilinmeyen Marka";
    const image = doc.image_front_url || doc.image_url || doc.image_small_url || null;
    const text = extractIngredientsText(doc);

    let analysis = null;
    if (text && text.length > 3) {
      analysis = analyze(text);
    }

    // Temiz, mobil dostu yanıt nesnesi
    res.json({
      id: doc._id,
      barcode: doc.code || doc._id,
      name,
      brand,
      image,
      countries: doc.countries_tags || [],
      has_ingredients: !!analysis,
      raw_ingredients: text,
      safety_summary: analysis ? {
        total_ingredients: analysis.total,
        matched_ingredients: analysis.matched,
        is_clean: analysis.banned.length === 0,
        has_banned: analysis.banned.length > 0,
        has_restricted: analysis.restricted.length > 0,
        has_allergens: analysis.allergens.length > 0,
        banned_count: analysis.banned.length,
        restricted_count: analysis.restricted.length,
        allergens_count: analysis.allergens.length,
        preservatives_count: analysis.preservatives.length,
        colorants_count: analysis.colorants.length,
        uv_filters_count: analysis.uvFilters.length
      } : null,
      flags_detail: analysis ? {
        banned: analysis.banned,
        restricted: analysis.restricted,
        allergens: analysis.allergens,
        preservatives: analysis.preservatives,
        colorants: analysis.colorants,
        uv_filters: analysis.uvFilters,
        unknown: analysis.unknown
      } : null,
      ingredients: analysis ? analysis.items.map(item => {
        const m = item.match;
        return {
          raw_name: item.raw,
          clean_name: item.clean,
          matched: !!m,
          inci_name: m ? m.inci_name : item.clean.toUpperCase(),
          cas: m ? m.cas : null,
          functions: m ? m.functions : [],
          functions_tr: m ? m.functions_tr : [],
          description_tr: m ? m.note_tr : "Bu madde için henüz açıklama bulunmuyor.",
          status: !m ? "unknown" : (m.flags.banned ? "banned" : m.flags.restricted ? "restricted" : m.flags.allergen ? "allergen" : "safe"),
          badges: m ? {
            banned: m.flags.banned,
            restricted: m.flags.restricted,
            allergen: m.flags.allergen,
            is_preservative: !!(m.eu_annex && m.eu_annex.preservative && m.eu_annex.preservative.length),
            is_colorant: !!(m.eu_annex && m.eu_annex.colorant && m.eu_annex.colorant.length),
            is_uv_filter: !!(m.eu_annex && m.eu_annex.uv_filter && m.eu_annex.uv_filter.length)
          } : null
        };
      }) : []
    });
  } catch (err) {
    console.error("Ürün detay hatası:", err);
    res.status(500).json({ error: "Ürün bilgileri alınırken bir hata oluştu." });
  }
});

// 4) Canlı Metin / OCR Analiz API'si (Fotoğraftan veya yapıştırmadan gelen ham metin)
// POST /api/analyze  Body: { "text": "Aqua, Glycerin, Niacinamide..." }
app.post("/api/analyze", (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    if (!text || text.length < 3) {
      return res.status(400).json({ error: "Lütfen analiz edilecek bir içerik listesi gönderin." });
    }

    const analysis = analyze(text);

    res.json({
      total: analysis.total,
      matched: analysis.matched,
      is_clean: analysis.banned.length === 0,
      safety_summary: {
        banned_count: analysis.banned.length,
        restricted_count: analysis.restricted.length,
        allergens_count: analysis.allergens.length,
        preservatives_count: analysis.preservatives.length,
        colorants_count: analysis.colorants.length,
        uv_filters_count: analysis.uvFilters.length,
        unknown_count: analysis.unknown.length
      },
      banned: analysis.banned,
      restricted: analysis.restricted,
      allergens: analysis.allergens,
      preservatives: analysis.preservatives,
      colorants: analysis.colorants,
      uv_filters: analysis.uvFilters,
      unknown: analysis.unknown,
      ingredients: analysis.items.map(item => {
        const m = item.match;
        return {
          raw_name: item.raw,
          clean_name: item.clean,
          matched: !!m,
          inci_name: m ? m.inci_name : item.clean.toUpperCase(),
          cas: m ? m.cas : null,
          functions: m ? m.functions : [],
          functions_tr: m ? m.functions_tr : [],
          description_tr: m ? m.note_tr : "Bu madde için henüz açıklama bulunmuyor.",
          status: !m ? "unknown" : (m.flags.banned ? "banned" : m.flags.restricted ? "restricted" : m.flags.allergen ? "allergen" : "safe"),
          badges: m ? {
            banned: m.flags.banned,
            restricted: m.flags.restricted,
            allergen: m.flags.allergen,
            is_preservative: !!(m.eu_annex && m.eu_annex.preservative && m.eu_annex.preservative.length),
            is_colorant: !!(m.eu_annex && m.eu_annex.colorant && m.eu_annex.colorant.length),
            is_uv_filter: !!(m.eu_annex && m.eu_annex.uv_filter && m.eu_annex.uv_filter.length)
          } : null
        };
      })
    });
  } catch (err) {
    console.error("Analiz hatası:", err);
    res.status(500).json({ error: "İçerik analizi yapılırken bir hata oluştu." });
  }
});

// Sunucuyu Başlat
(async () => {
  await initMongo();
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 INCI Engine REST API Servisi Basariyla Baslatildi!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`📚 Arayüz (Test Paneli): http://localhost:${PORT}`);
    console.log(`🔍 Arama API: GET http://localhost:${PORT}/api/products/search?q=nivea`);
    console.log(`📋 Barkod API: GET http://localhost:${PORT}/api/products/8682536069403`);
    console.log(`⚡ Analiz API: POST http://localhost:${PORT}/api/analyze`);
    console.log(`======================================================\n`);
  });
})();
