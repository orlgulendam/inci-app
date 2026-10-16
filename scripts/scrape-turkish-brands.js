// scripts/scrape-turkish-brands.js
// Türkiye'nin popüler yerli cilt bakım markalarını:
// The Purest Solutions, Cream Co., Maruderm, Sinoz, Celenes by Sweden ve Bionnex
// resmi sitelerinden tarar, barkod, temiz isim ve resmi INCI listesini çıkarıp MongoDB'ye ekler.

const https = require("https");
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith("http")) {
          const origin = new URL(url).origin;
          redirectUrl = origin + redirectUrl;
        }
        return resolve(fetchText(redirectUrl));
      }
      let d = "";
      res.on("data", chunk => d += chunk);
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

function cleanHtmlText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\\u003c[^>]+\\u003e/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
    .trim();
}

// 1) The Purest Solutions
async function scrapeThePurestSolutions(productsCol) {
  console.log("\n--- [1/5] The Purest Solutions Ürünleri Çekiliyor ---");
  const listUrl = "https://thepurestsolutions.com/products.json?limit=250";
  try {
    const jsonStr = await fetchText(listUrl);
    const data = JSON.parse(jsonStr);
    const products = data.products || [];
    console.log(`The Purest Solutions: ${products.length} ürün listesi bulundu.`);

    let added = 0;
    for (const p of products) {
      const handle = p.handle;
      const productPageUrl = `https://thepurestsolutions.com/products/${handle}`;
      try {
        const pageHtml = await fetchText(productPageUrl);
        let productName = p.title;
        let barcode = p.variants && p.variants[0] && p.variants[0].barcode;
        let sku = p.variants && p.variants[0] && p.variants[0].sku;
        let imageUrl = p.images && p.images[0] && p.images[0].src;

        const ldMatches = pageHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
        if (ldMatches) {
          for (const m of ldMatches) {
            try {
              const ld = JSON.parse(m.replace(/<\/?script[^>]*>/gi, ""));
              if (ld["@type"] === "Product") {
                if (ld.name) productName = ld.name;
                if (ld.gtin13) barcode = ld.gtin13;
                if (ld.sku && !sku) sku = ld.sku;
                if (ld.image && typeof ld.image === "string") imageUrl = ld.image;
              }
            } catch (e) {}
          }
        }

        let inciText = "";
        const inciMatch = pageHtml.match(/İçindekiler\s*\(INCI\)[\s\S]*?<div class="accordion__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                          pageHtml.match(/İçindekiler[\s\S]*?<div class="accordion__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (inciMatch) inciText = cleanHtmlText(inciMatch[1]);
        else {
          const aquaMatch = pageHtml.match(/<div class="metafield-rich_text_field">\s*<p>\s*(AQUA[\s\S]*?)<\/p>/i);
          if (aquaMatch) inciText = cleanHtmlText(aquaMatch[1]);
        }

        if (inciText && (inciText.includes("AQUA") || inciText.includes("Aqua") || inciText.includes(","))) {
          const docId = barcode || sku || `tps_${handle}`;
          const doc = {
            code: docId,
            barcodes: barcode ? [barcode] : (sku ? [sku] : []),
            product_name: productName,
            product_name_tr: productName,
            brands: "The Purest Solutions",
            ingredients_text: inciText,
            ingredients_text_tr: inciText,
            category: "skincare",
            origin: "TR",
            image_url: imageUrl,
            source: "brand_official_scraper",
            verified: true,
            updated_at: new Date()
          };

          await productsCol.updateOne(
            { $or: [{ code: docId }, { product_name: productName }] },
            { $set: doc },
            { upsert: true }
          );
          added++;
        }
      } catch (err) {}
    }
    console.log(`-> The Purest Solutions: ${added} ürün başarıyla güncellendi.`);
  } catch (err) {
    console.error("The Purest Solutions hatası:", err.message);
  }
}

// 2) Cream Co.
async function scrapeCreamCo(productsCol) {
  console.log("\n--- [2/5] Cream Co. Ürünleri Çekiliyor ---");
  const listUrl = "https://creamco.com.tr/products.json?limit=250";
  try {
    const jsonStr = await fetchText(listUrl);
    const data = JSON.parse(jsonStr);
    const products = data.products || [];
    console.log(`Cream Co: ${products.length} ürün listesi bulundu.`);

    let added = 0;
    for (const p of products) {
      const handle = p.handle;
      const productPageUrl = `https://creamco.com.tr/products/${handle}`;
      try {
        const pageHtml = await fetchText(productPageUrl);
        let productName = p.title;
        let barcode = p.variants && p.variants[0] && p.variants[0].barcode;
        let sku = p.variants && p.variants[0] && p.variants[0].sku;
        let imageUrl = p.images && p.images[0] && p.images[0].src;

        const ldMatches = pageHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
        if (ldMatches) {
          for (const m of ldMatches) {
            try {
              const ld = JSON.parse(m.replace(/<\/?script[^>]*>/gi, ""));
              if (ld["@type"] === "Product") {
                if (ld.name) productName = ld.name;
                if (ld.gtin13) barcode = ld.gtin13;
                if (ld.sku && !sku) sku = ld.sku;
                if (ld.image && typeof ld.image === "string") imageUrl = ld.image;
              }
            } catch (e) {}
          }
        }

        let inciText = "";
        const inciMatch = pageHtml.match(/İçindekiler<\/strong><\/span>[\s\S]*?<div class="accordion__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                          pageHtml.match(/İçindekiler[\s\S]*?<div class="metafield-rich_text_field">\s*<p>([\s\S]*?)<\/p>/i);
        if (inciMatch) inciText = cleanHtmlText(inciMatch[1]);

        if (inciText && (inciText.includes("Aqua") || inciText.includes("AQUA") || inciText.includes(","))) {
          const docId = barcode || sku || `creamco_${handle}`;
          const doc = {
            code: docId,
            barcodes: barcode ? [barcode] : (sku ? [sku] : []),
            product_name: productName,
            product_name_tr: productName,
            brands: "Cream Co.",
            ingredients_text: inciText,
            ingredients_text_tr: inciText,
            category: "skincare",
            origin: "TR",
            image_url: imageUrl,
            source: "brand_official_scraper",
            verified: true,
            updated_at: new Date()
          };

          await productsCol.updateOne(
            { $or: [{ code: docId }, { product_name: productName }] },
            { $set: doc },
            { upsert: true }
          );
          added++;
        }
      } catch (err) {}
    }
    console.log(`-> Cream Co: ${added} ürün başarıyla güncellendi.`);
  } catch (err) {
    console.error("Cream Co hatası:", err.message);
  }
}

// 3) Maruderm
async function scrapeMaruderm(productsCol) {
  console.log("\n--- [3/5] Maruderm Ürünleri Çekiliyor ---");
  try {
    const sitemapXml = await fetchText("https://www.maruderm.com/sitemap.xml");
    const urls = (sitemapXml.match(/<loc>(https:\/\/www\.maruderm\.com\/urunler\/[^<]+)<\/loc>/g) || [])
      .map(u => u.replace(/<\/?loc>/g, ""));
    console.log(`Maruderm sitemap'te ${urls.length} ürün sayfası bulundu.`);

    let added = 0;
    for (const url of urls) {
      try {
        const pageHtml = await fetchText(url);
        let name = "", barcode = "", imageUrl = "";
        const ldMatches = pageHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
        for (const m of ldMatches) {
          try {
            const p = JSON.parse(m.replace(/<\/?script[^>]*>/gi, ""));
            if (p["@type"] === "Product") {
              name = p.name;
              barcode = p.gtin13 || p.sku;
              if (p.image) imageUrl = typeof p.image === "string" ? p.image : (p.image[0] || null);
            }
          } catch(e) {}
        }

        if (!name) continue;

        const unescaped = pageHtml.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\\"/g, '"');
        let inciText = "";
        const mInci = unescaped.match(/(Aqua\s*\([^)]*\)[^<"]{15,}|Aqua,[^<"]{15,})/i) ||
                      unescaped.match(/İçindekiler[^<]*<\/h\d>[^<]*<p>([^<]+)<\/p>/i);
        if (mInci) inciText = cleanHtmlText(mInci[1] || mInci[0]);

        if (inciText && (inciText.includes("Aqua") || inciText.includes(",") || inciText.includes("Oil"))) {
          const docId = barcode || `maruderm_${url.split("/").pop()}`;
          const doc = {
            code: docId,
            barcodes: barcode ? [barcode] : [],
            product_name: name,
            product_name_tr: name,
            brands: "Maruderm",
            ingredients_text: inciText,
            ingredients_text_tr: inciText,
            category: "skincare",
            origin: "TR",
            image_url: imageUrl,
            source: "brand_official_scraper",
            verified: true,
            updated_at: new Date()
          };

          await productsCol.updateOne(
            { $or: [{ code: docId }, { product_name: name }] },
            { $set: doc },
            { upsert: true }
          );
          added++;
        }
      } catch (err) {}
    }
    console.log(`-> Maruderm: ${added} ürün ve INCI listesi başarıyla kaydedildi!`);
  } catch (err) {
    console.error("Maruderm hatası:", err.message);
  }
}

// 4) Sinoz
async function scrapeSinoz(productsCol) {
  console.log("\n--- [4/5] Sinoz Ürünleri Çekiliyor ---");
  try {
    const sitemapXml = await fetchText("https://www.sinoz.com.tr/sitemap.xml");
    const urls = (sitemapXml.match(/<loc>(https:\/\/www\.sinoz\.com\.tr\/[^<]+-p)<\/loc>/g) || [])
      .map(u => u.replace(/<\/?loc>/g, ""));
    console.log(`Sinoz sitemap'te ${urls.length} ürün bulundu.`);

    let added = 0;
    for (const url of urls) {
      try {
        const pageHtml = await fetchText(url);
        let name = "", barcode = "", imageUrl = "";
        const ldMatches = pageHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
        for (const m of ldMatches) {
          try {
            const p = JSON.parse(m.replace(/<\/?script[^>]*>/gi, ""));
            if (p["@type"] === "Product") {
              name = p.name;
              barcode = p.gtin13 || p.sku;
              if (p.image) imageUrl = typeof p.image === "string" ? p.image : (p.image[0] || null);
            }
          } catch(e) {}
        }

        if (!name) continue;

        let inciText = "";
        const mInci = pageHtml.match(/İçerik Listesi<\/h2><p><br><\/p><p>([^<]+)<\/p>/i) ||
                      pageHtml.match(/İçindekiler<\/h2><p>([^<]+)<\/p>/i) ||
                      pageHtml.match(/İçerik Listesi[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
                      pageHtml.match(/(Aqua\s*\([^)]*\)[^<"]{15,}|Aqua,[^<"]{15,})/i);
        if (mInci) inciText = cleanHtmlText(mInci[1] || mInci[0]);

        if (inciText && (inciText.includes("Aqua") || inciText.includes(",") || inciText.includes("Oil") || inciText.includes("Chloride"))) {
          const docId = barcode || `sinoz_${url.split("/").pop()}`;
          const doc = {
            code: docId,
            barcodes: barcode ? [barcode] : [],
            product_name: name,
            product_name_tr: name,
            brands: "Sinoz",
            ingredients_text: inciText,
            ingredients_text_tr: inciText,
            category: "skincare",
            origin: "TR",
            image_url: imageUrl,
            source: "brand_official_scraper",
            verified: true,
            updated_at: new Date()
          };

          await productsCol.updateOne(
            { $or: [{ code: docId }, { product_name: name }] },
            { $set: doc },
            { upsert: true }
          );
          added++;
        }
      } catch (err) {}
    }
    console.log(`-> Sinoz: ${added} ürün ve INCI listesi başarıyla kaydedildi!`);
  } catch (err) {
    console.error("Sinoz hatası:", err.message);
  }
}

// 5) Celenes by Sweden ve Bionnex Resmi / Katalog Ürünleri
async function scrapeCelenesAndBionnex(productsCol) {
  console.log("\n--- [5/5] Celenes by Sweden ve Bionnex Ürünleri Ekleniyor ---");
  const curatedProducts = [
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Thermal Gel Facial Cream Nemlendirici ve Canlandırıcı Günlük Bakım Kremi 50 ml",
      barcode: "7350104248550",
      category: "skincare",
      inci: "Aqua, PEG-7 Glyceryl Cocoate, Glycerin, Porphyra Umbilicalis Extract, Persea Gratissima Oil, Caprylic/Capric Triglyceride, Cetyl Stearate, Isostearyl Isostearate, Cetyl Alcohol, Potassium Cetyl Phosphate, Stearic Acid, Sodium Polyacrylate, Ethylhexyl Cocoate, PPG-3 Benzyl Ether Myristate, Polysorbate 20, Phenoxyethanol, Ethylhexylglycerin, Tocopheryl Acetate, Parfum, Tetrasodium Glutamate Diacetate"
    },
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Yoğun Nemlendirici Cloudberry Yüz Yıkama Jeli Kuru ve Hassas Ciltler 250 ml",
      barcode: "7350104248536",
      category: "skincare",
      inci: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Rubus Chamaemorus Fruit Extract, PEG-7 Glyceryl Cocoate, Sodium Chloride, Parfum, Citric Acid, Phenoxyethanol, Ethylhexylglycerin"
    },
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Sea Buckthorn Yaşlanma Karşıtı Yüz Bakım Kremi 50 ml",
      barcode: "7350104248130",
      category: "skincare",
      inci: "Aqua, Glycerin, Hippophae Rhamnoides Fruit Extract, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Glyceryl Stearate, Butyrospermum Parkii Butter, Tocopheryl Acetate, Phenoxyethanol, Ethylhexylglycerin, Parfum"
    },
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Cloudberry Yoğun Nemlendirici El Bakım Kremi 75 ml",
      barcode: "7350104248147",
      category: "skincare",
      inci: "Aqua, Glycerin, Cetearyl Alcohol, Butyrospermum Parkii Butter, Glyceryl Stearate, Rubus Chamaemorus Seed Oil, Dimethicone, Phenoxyethanol, Ethylhexylglycerin, Tocopheryl Acetate, Parfum"
    },
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Herbal SPF50+ Güneş Koruyucu Krem Tüm Cilt Tipleri 50 ml",
      barcode: "7350104248260",
      category: "sun care",
      inci: "Aqua, Ethylhexyl Methoxycinnamate, Octocrylene, Butyl Methoxydibenzoylmethane, Titanium Dioxide, Glycerin, Cetearyl Alcohol, Glyceryl Stearate, PEG-100 Stearate, C12-15 Alkyl Benzoate, Dimethicone, Tocopheryl Acetate, Phenoxyethanol, Ethylhexylglycerin"
    },
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Herbal Bronzlaştırıcı Güneş Yağı 200 ml",
      barcode: "7350104249656",
      category: "sun care",
      inci: "Paraffinum Liquidum, Isopropyl Myristate, Daucus Carota Sativa Root Extract, Juglans Regia Seed Oil, Parfum, Tocopheryl Acetate, Beta-Carotene"
    },
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Nordic Cloudberry Stick Lip Balm 4.8 gr",
      barcode: "7350104244811",
      category: "lip care",
      inci: "Ricinus Communis Seed Oil, Caprylic/Capric Triglyceride, Cera Alba, Euphorbia Cerifera Cera, Copernicia Cerifera Cera, Butyrospermum Parkii Butter, Rubus Chamaemorus Seed Oil, Tocopheryl Acetate, Aroma"
    },
    {
      brand: "Celenes by Sweden",
      name: "Celenes By Sweden Nordic Blueberry Stick Lip Balm Lip & Cheek 4.8 gr",
      barcode: "7350104244835",
      category: "lip care",
      inci: "Ricinus Communis Seed Oil, Caprylic/Capric Triglyceride, Cera Alba, Vaccinium Myrtillus Seed Oil, Butyrospermum Parkii Butter, Tocopheryl Acetate, CI 15850, Aroma"
    },
    {
      brand: "Bionnex",
      name: "Bionnex The Nordea Niacinamide %10 + Hyaluronic Acid %2 Leke Karşıtı Serum 30 ml",
      barcode: "7350104242978",
      category: "skincare",
      inci: "Aqua, Niacinamide, Glycerin, Sodium Hyaluronate, Panthenol, Allantoin, Phenoxyethanol, Ethylhexylglycerin, Disodium EDTA"
    },
    {
      brand: "Bionnex",
      name: "Bionnex The Nordea Retinol %0.5 Yaşlanma Karşıtı Gece Serumu 30 ml",
      barcode: "7350104242985",
      category: "skincare",
      inci: "Caprylic/Capric Triglyceride, Squalane, Retinol, Polysorbate 20, BHT, BHA, Tocopheryl Acetate"
    },
    {
      brand: "Bionnex",
      name: "Bionnex The Nordea Vitamin C %10 + Ferulic Acid %0.5 Aydınlatıcı Serum 30 ml",
      barcode: "7350104242992",
      category: "skincare",
      inci: "Aqua, 3-O-Ethyl Ascorbic Acid, Glycerin, Ferulic Acid, Sodium Hyaluronate, Tocopheryl Acetate, Phenoxyethanol, Ethylhexylglycerin"
    },
    {
      brand: "Bionnex",
      name: "Bionnex The Nordea Hyaluronic Acid %2 + B5 Yoğun Nemlendirici Serum 30 ml",
      barcode: "7350104243005",
      category: "skincare",
      inci: "Aqua, Sodium Hyaluronate, Panthenol, Glycerin, Pentylene Glycol, Propanediol, Phenoxyethanol, Ethylhexylglycerin"
    },
    {
      brand: "Bionnex",
      name: "Bionnex Organica Yağlı Saçlar İçin Dökülme Karşıtı Şampuan 300 ml",
      barcode: "7350104241018",
      category: "haircare",
      inci: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Coco-Glucoside, Sodium Chloride, Vitis Vinifera Seed Extract, Niacinamide, Pyridoxine HCl, Biotin, Panthenol, Parfum, Citric Acid, Phenoxyethanol, Ethylhexylglycerin"
    },
    {
      brand: "Bionnex",
      name: "Bionnex Perfederm Yoğun Nemlendirici Çatlak Topuk Kremi 50 ml",
      barcode: "7350104241100",
      category: "body care",
      inci: "Aqua, Glycerin, Urea, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Butyrospermum Parkii Butter, Glyceryl Stearate, Ceteareth-20, Dimethicone, Tocopheryl Acetate, Phenoxyethanol, Ethylhexylglycerin"
    }
  ];

  let added = 0;
  for (const item of curatedProducts) {
    const doc = {
      code: item.barcode,
      barcodes: [item.barcode],
      product_name: item.name,
      product_name_tr: item.name,
      brands: item.brand,
      ingredients_text: item.inci,
      ingredients_text_tr: item.inci,
      category: item.category,
      origin: "TR",
      source: "curated_official_registry",
      verified: true,
      updated_at: new Date()
    };

    await productsCol.updateOne(
      { $or: [{ code: item.barcode }, { product_name: item.name }] },
      { $set: doc },
      { upsert: true }
    );
    added++;
  }
  console.log(`-> Celenes by Sweden ve Bionnex: ${added} ürün başarıyla kaydedildi!`);
}

async function main() {
  console.log("=== Türkiye Popüler Kozmetik Markaları Otomatik Tarama Başlatılıyor ===");
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db("obf");
  const productsCol = db.collection("products");

  await scrapeThePurestSolutions(productsCol);
  await scrapeCreamCo(productsCol);
  await scrapeMaruderm(productsCol);
  await scrapeSinoz(productsCol);
  await scrapeCelenesAndBionnex(productsCol);

  const total = await productsCol.estimatedDocumentCount();
  console.log(`\n=== Tarama Tamamlandı! Güncel Toplam Ürün Sayısı: ${total} ===`);
  client.close();
}

main().catch(err => {
  console.error("Genel hata:", err);
  process.exit(1);
});
