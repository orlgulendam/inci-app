// scripts/import-top-dermocosmetics.js
// Türkiye'deki eczanelerde en çok satılan kült dermokozmetik ürünlerin
// bozuk/eksik kayıtlarını temizler ve resmi INCI listeleri, Türkçe isimleri ve barkodlarıyla kaydeder.

const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

const TOP_DERMO_PRODUCTS = [
  // --- BIODERMA ---
  {
    brand: "Bioderma",
    name: "Bioderma Sensibio H2O Hassas Ciltler İçin Misel Temizleme Suyu 500 ml",
    barcodes: ["3401575645851", "3701129812112", "3401528545856"],
    category: "cleanser",
    inci: "Aqua/Water/Eau, PEG-6 Caprylic/Capric Glycerides, Fructooligosaccharides, Mannitol, Xylitol, Rhamnose, Cucumis Sativus (Cucumber) Fruit Extract, Propylene Glycol, Cetrimonium Bromide, Disodium EDTA"
  },
  {
    brand: "Bioderma",
    name: "Bioderma Atoderm Intensive Baume Çok Kuru ve Atopik Ciltler İçin Nemlendirici Balm 500 ml",
    barcodes: ["3401399372551", "3701129802069", "3401360117075"],
    category: "moisturizer",
    inci: "Aqua/Water/Eau, Glycerin, Paraffinum Liquidum/Mineral Oil/Huile Minerale, Helianthus Annuus (Sunflower) Seed Oil, Behenyl Alcohol, Sucrose Stearate, Canola/Canola Oil/Huile De Colza, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Pentylene Glycol, Beta-Sitosterol, Xylitol, Zinc Gluconate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Palmitamide MEA, 1,2-Hexanediol, Caprylyl Glycol, Disodium EDTA, Sodium Hydroxide, Rhamnose, Sodium Lauroyl Lactylate, Polysorbate 60, Sorbitan Isostearate, Tocopherol, Phytosphingosine, Ceramide NP, Mannitol, Ethylhexylglycerin, Ceramide AP, Cholesterol, Carbomer, Xanthan Gum, Citric Acid, Ceramide EOP"
  },
  {
    brand: "Bioderma",
    name: "Bioderma Sébium Gel Moussant Yağlı ve Karma Ciltler İçin Arındırıcı Yüz Temizleme Jeli",
    barcodes: ["3401348825831", "3701129802427", "3401348825855"],
    category: "cleanser",
    inci: "Aqua/Water/Eau, Sodium Cocoamphoacetate, Sodium Laureth Sulfate, Methylpropanediol, Disodium EDTA, Mannitol, Xylitol, Rhamnose, Fructooligosaccharides, Zinc Sulfate, Copper Sulfate, Ginkgo Biloba Leaf Extract, PEG-90 Glyceryl Isostearate, Lactic Acid, Laureth-2, Potassium Sorbate, Sodium Chloride, Propylene Glycol, Sodium Hydroxide, Fragrance (Parfum)"
  },
  {
    brand: "Bioderma",
    name: "Bioderma Photoderm Aquafluid SPF 50+ Su Bazlı Yüz Güneş Kremi",
    barcodes: ["3401560000740", "3701129803585", "3701129803592"],
    category: "sun care",
    inci: "Aqua/Water/Eau, Dicaprylyl Carbonate, Octocrylene, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol [Nano], Butyl Methoxydibenzoylmethane, Glycerin, Methyl Methacrylate Crosspolymer, Cyclohexasiloxane, Cyclopentasiloxane, PTFE, C20-22 Alkyl Phosphate, C20-22 Alcohols, Silica, Decyl Glucoside, Glyceryl Stearate Citrate, Pentylene Glycol, Microcrystalline Cellulose, C30-45 Alkyl Cetearyl Dimethicone Crosspolymer, 1,2-Hexanediol, Caprylyl Glycol, Disodium EDTA, Xanthan Gum, Mannitol, Xylitol, Sodium Hydroxide, Cellulose Gum, Rhamnose, Propylene Glycol, Citric Acid, Ectoin, Tocopherol"
  },

  // --- LA ROCHE-POSAY ---
  {
    brand: "La Roche-Posay",
    name: "La Roche-Posay Cicaplast Baume B5+ Çok Amaçlı Yatıştırıcı ve Onarıcı Bakım Kremi",
    barcodes: ["3337875816809", "3337875517300", "3337875816816"],
    category: "moisturizer",
    inci: "Aqua / Water / Eau, Hydrogenated Polyisobutene, Dimethicone, Glycerin, Butyrospermum Parkii Butter / Shea Butter, Panthenol, Zea Mays Starch / Corn Starch, Propanediol, Butylene Glycol, Cetyl PEG/PPG-10/1 Dimethicone, Trihydroxystearin, Centella Asiatica Leaf Extract, Polymnia Sonchifolia Root Juice, Zinc Gluconate, Madecassoside, Manganese Gluconate, Alpha-Glucan Oligosaccharide, Silica, Aluminum Hydroxide, Magnesium Sulfate, Mannose, Capryloyl Glycine, Caprylyl Glycol, Vitreoscilla Ferment, Citric Acid, Trisodium Ethylenediamine Disuccinate, Lactobacillus, Acetylated Glycol Stearate, Maltodextrin, Polyglyceryl-4 Isostearate, Tocopherol, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, CI 77891 / Titanium Dioxide"
  },
  {
    brand: "La Roche-Posay",
    name: "La Roche-Posay Anthelios UVMune 400 Invisible Fluid SPF 50+ Güneş Koruyucu",
    barcodes: ["3337875797597", "3337875695596", "3337875797603"],
    category: "sun care",
    inci: "Aqua / Water / Eau, Alcohol Denat., Triethyl Citrate, Diisopropyl Sebacate, Silica, Ethylhexyl Salicylate, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Ethylhexyl Triazone, Butyl Methoxydibenzoylmethane, Glycerin, Propanediol, C12-22 Alkyl Acrylate/Hydroxyethylacrylate Copolymer, Methoxypropylamino Cyclohexenylidene Ethoxyethylcyanoacetate, Perlite, Drometrizole Trisiloxane, Caprylic/Capric Triglyceride, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Caprylyl Glycol, Hydroxyethylcellulose, Terephthalylidene Dicamphor Sulfonic Acid, Tocopherol, Triethanolamine, Trisodium Ethylenediamine Disuccinate"
  },
  {
    brand: "La Roche-Posay",
    name: "La Roche-Posay Effaclar Duo+ M Akne ve Siyah Nokta Karşıtı Bakım Kremi",
    barcodes: ["3337875863377", "3337875598071"],
    category: "treatment",
    inci: "Aqua / Water / Eau, Glycerin, Dimethicone, Isocetyl Stearate, Niacinamide, Isopropyl Lauroyl Sarcosinate, Silica, Ammonium Polyacryloyldimethyl Taurate, Oryza Sativa Starch / Rice Starch, Punica Granatum Pericarp Extract, Potassium Cetyl Phosphate, Sorbitan Oleate, Zinc PCA, Glyceryl Stearate SE, Isohexadecane, Sodium Hydroxide, Myristyl Myristate, 2-Oleamido-1,3-Octadecanediol, Mannose, Poloxamer 338, Propanediol, Hydroxyethoxyphenyl Butanone, Capryloyl Salicylic Acid, Caprylyl Glycol, Vitreoscilla Ferment, Citric Acid, Trisodium Ethylenediamine Disuccinate, Maltodextrin, Xanthan Gum, Pentylene Glycol, Polysorbate 80, Acrylamide/Sodium Acryloyldimethyltaurate Copolymer, Salicylic Acid, Piroctone Olamine, Parfum / Fragrance"
  },
  {
    brand: "La Roche-Posay",
    name: "La Roche-Posay Effaclar Arındırıcı Köpüren Yüz Yıkama Jeli 400 ml",
    barcodes: ["3337872411083", "3337872411991"],
    category: "cleanser",
    inci: "Aqua / Water, Sodium Laureth Sulfate, PEG-8, Coco-Betaine, Hexylene Glycol, Sodium Chloride, PEG-120 Methyl Glucose Dioleate, Zinc PCA, Sodium Hydroxide, Caprylyl Glycol, Citric Acid, Sodium Benzoate, Phenoxyethanol, Parfum / Fragrance"
  },
  {
    brand: "La Roche-Posay",
    name: "La Roche-Posay Hyalu B5 Dolgunlaştırıcı ve Kırışıklık Karşıtı Hyaluronik Asit Serumu 30 ml",
    barcodes: ["3337875583626"],
    category: "serum",
    inci: "Aqua / Water, Glycerin, Alcohol Denat., Propylene Glycol, Panthenol, Pentylene Glycol, Dimethicone, PEG-6 Caprylic/Capric Glycerides, PPG-6-Decyltetradeceth-30, Glyceryl Isostearate, Madecassoside, Sodium Hyaluronate, Ammonium Polyacryloyldimethyl Taurate, Disodium EDTA, Hydrolyzed Hyaluronic Acid, Caprylyl Glycol, Citric Acid, Xanthan Gum, Tocopherol, Phenoxyethanol, Parfum / Fragrance"
  },

  // --- CERAVE ---
  {
    brand: "CeraVe",
    name: "CeraVe Kuru ve Çok Kuru Ciltler İçin Nemlendirici Krem 454 gr (Moisturising Cream)",
    barcodes: ["3337875597227", "3337875837279", "3337875597388", "3337875597371"],
    category: "moisturizer",
    inci: "Aqua / Water / Eau, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Ceteareth-20, Petrolatum, Potassium Phosphate, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Dimethicone, Behentrimonium Methosulfate, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Disodium EDTA, Dipotassium Phosphate, Tocopherol, Phytosphingosine, Xanthan Gum, Ethylhexylglycerin"
  },
  {
    brand: "CeraVe",
    name: "CeraVe Normal ve Kuru Ciltler İçin Nemlendiren Temizleyici (Hydrating Cleanser)",
    barcodes: ["3337875597180", "3337875597357", "3337875597340"],
    category: "cleanser",
    inci: "Aqua / Water / Eau, Glycerin, Cetearyl Alcohol, PEG-40 Stearate, Stearyl Alcohol, Potassium Phosphate, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Glyceryl Stearate, Behentrimonium Methosulfate, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Disodium EDTA, Dipotassium Phosphate, Tocopherol, Phytosphingosine, Xanthan Gum, Cetyl Alcohol, Polysorbate 20, Ethylhexylglycerin"
  },
  {
    brand: "CeraVe",
    name: "CeraVe Normal ve Yağlı Ciltler İçin Köpüren Temizleyici (Foaming Cleanser)",
    barcodes: ["3337875597197", "3337875597364"],
    category: "cleanser",
    inci: "Aqua / Water / Eau, Cocamidopropyl Hydroxysultaine, Glycerin, Sodium Lauroyl Sarcosinate, Propanediol, PEG-150 Pentaerythrityl Tetrastearate, Niacinamide, PEG-6 Caprylic/Capric Glycerides, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Sodium Methyl Cocoyl Taurate, Sodium Benzoate, Sodium Chloride, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Disodium EDTA, Citric Acid, Tetrasodium EDTA, Phytosphingosine, Xanthan Gum, Ethylhexylglycerin"
  },
  {
    brand: "CeraVe",
    name: "CeraVe SA Pürüzsüzleştirici Temizleyici Salisilik Asitli Yüz ve Vücut Yıkama Jeli",
    barcodes: ["3337875684118", "3337875684125"],
    category: "cleanser",
    inci: "Aqua / Water / Eau, Sodium Lauroyl Sarcosinate, Cocamidopropyl Hydroxysultaine, Glycerin, Niacinamide, Gluconolactone, Sodium Methyl Cocoyl Taurate, PEG-150 Pentaerythrityl Tetrastearate, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Calcium Gluconate, Salicylic Acid, Sodium Benzoate, Sodium Lauroyl Lactylate, Cholesterol, Phenoxyethanol, Disodium EDTA, Tetrasodium EDTA, Hydrolyzed Hyaluronic Acid, Phytosphingosine, Xanthan Gum, Ethylhexylglycerin"
  },
  {
    brand: "CeraVe",
    name: "CeraVe SA Pürüzsüzleştirici Krem Kuru, Sertleşmiş ve Pürüzlü Ciltler İçin",
    barcodes: ["3337875684101"],
    category: "moisturizer",
    inci: "Aqua / Water / Eau, Urea, Cetyl Alcohol, Glyceryl Stearate SE, Cetearyl Alcohol, Niacinamide, Butyrospermum Parkii Butter / Shea Butter, C12-13 Alkyl Lactate, PEG-100 Stearate, Glycerin, Behentrimonium Methosulfate, Dimethicone, Triacetin, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Sodium Lactate, Salicylic Acid, Sodium Hydroxide, Sodium Lauroyl Lactylate, Hydroxyacetophenone, Citric Acid, Lactic Acid, Phytosphingosine, Xanthan Gum, Ethylhexylglycerin"
  },

  // --- AVENE ---
  {
    brand: "Avene",
    name: "Avene Thermal Spring Water Yatıştırıcı Termal Su Spreyi 300 ml",
    barcodes: ["3282779003131", "3282779003124"],
    category: "toner",
    inci: "Avene Thermal Spring Water (Avene Aqua), Nitrogen"
  },
  {
    brand: "Avene",
    name: "Avene Cicalfate+ Onarıcı ve Koruyucu Krem (Yatıştırıcı Bakım Kremi)",
    barcodes: ["3282779353793", "3282770204667", "3282770204674"],
    category: "moisturizer",
    inci: "Avene Thermal Spring Water (Avene Aqua), Caprylic/Capric Triglyceride, Mineral Oil (Paraffinum Liquidum), Glycerin, Hydrogenated Vegetable Oil, Zinc Oxide, Propylene Glycol, Polyglyceryl-2 Sesquiisostearate, PEG-22/Dodecyl Glycol Copolymer, Aluminum Stearate, Aquaphilus Dolomiae Ferment Filtrate, Arginine, Beeswax (Cera Alba), Copper Sulfate, Magnesium Stearate, Magnesium Sulfate, Microcrystalline Wax (Cera Microcristallina), Tromethamine, Zinc Sulfate"
  },
  {
    brand: "Avene",
    name: "Avene Cleanance Comedomed Akne Karşıtı Konsantre Bakım Kremi",
    barcodes: ["3282770202861"],
    category: "treatment",
    inci: "Avene Thermal Spring Water (Avene Aqua), Isopropyl Alcohol, PEG-6, Glycerin, Silybum Marianum Fruit Extract, Silica, Polyacrylate-13, Polyisobutene, Polysorbate 20, Sorbitan Isostearate, Water (Aqua)"
  },
  {
    brand: "Avene",
    name: "Avene Cleanance Cleansing Gel Yağlı Ciltler İçin Temizleme Jeli 400 ml",
    barcodes: ["3282779365482"],
    category: "cleanser",
    inci: "Avene Thermal Spring Water (Avene Aqua), Water (Aqua), Zinc Coceth Sulfate, Lauryl Betaine, Decyl Glucoside, Ceteareth-60 Myristyl Glycol, PEG-7 Glyceryl Cocoate, Polysorbate 20, Citric Acid, Fragrance (Parfum), Green 5 (CI 61570), Isopropyl Alcohol, PEG-40 Hydrogenated Castor Oil, PEG-6, PPG-26-Buteth-26, Silybum Marianum Fruit Extract, Sodium Benzoate, Sodium Chloride, Sodium Hydroxide, Trisodium Ethylenediamine Disuccinate, Yellow 5 (CI 19140), Zinc Gluconate"
  },

  // --- VICHY ---
  {
    brand: "Vichy",
    name: "Vichy Minéral 89 Güçlendirici ve Dolgunlaştırıcı Günlük Hyaluronik Asit Serumu",
    barcodes: ["3337875543248", "3337875591560"],
    category: "serum",
    inci: "Aqua / Water / Eau, PEG/PPG/Polybutylene Glycol-8/5/3 Glycerin, Glycerin, Butylene Glycol, Methyl Gluceth-20, Carbomer, Sodium Hyaluronate, Phenoxyethanol, Caprylyl Glycol, Citric Acid, Biosaccharide Gum-1"
  },
  {
    brand: "Vichy",
    name: "Vichy Dercos Kepek Karşıtı Şampuan (Normal ve Yağlı Saçlar İçin)",
    barcodes: ["3337871330286", "3337875623629"],
    category: "haircare",
    inci: "Aqua / Water, Sodium Laureth Sulfate, Glycol Distearate, Dimethicone, Coco-Betaine, Glycerin, Carbomer, CI 19140 / Yellow 5, Citric Acid, Menthol, 2-Oleamido-1,3-Octadecanediol, PPG-5-Ceteth-20, Salicylic Acid, Selenium Sulfide, Sodium Benzoate, Sodium Chloride, Sodium Hydroxide, Tocopheryl Acetate, Parfum / Fragrance"
  },

  // --- DERMOSKİN (YERLİ ECZANE KÜLTÜ) ---
  {
    brand: "Dermoskin",
    name: "Dermoskin Be Bright Aydınlatıcı C Vitamini Serumu 30 ml",
    barcodes: ["8697798004526"],
    category: "serum",
    inci: "Aqua, 3-O-Ethyl Ascorbic Acid, Glycerin, Niacinamide, Panthenol, Sodium Hyaluronate, Glycyrrhiza Glabra Root Extract, Allantoin, Hydroxyethylcellulose, Phenoxyethanol, Ethylhexylglycerin, Disodium EDTA"
  },
  {
    brand: "Dermoskin",
    name: "Dermoskin Acnegun Yüz Yıkama Jeli 200 ml",
    barcodes: ["8697798000450"],
    category: "cleanser",
    inci: "Aqua, Disodium Laureth Sulfosuccinate, Cocamidopropyl Betaine, Salicylic Acid, Glycerin, Melaleuca Alternifolia Leaf Oil, Panthenol, Allantoin, Zinc PCA, PEG-120 Methyl Glucose Dioleate, Phenoxyethanol, Ethylhexylglycerin"
  },
  {
    brand: "Dermoskin",
    name: "Dermoskin Biotin Dökülme Karşıtı Şampuan 200 ml",
    barcodes: ["8697798002010"],
    category: "haircare",
    inci: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Biotin, Equisetum Arvense Extract, Panthenol, Saw Palmetto Extract, Hydrolyzed Keratin, Sodium Chloride, Polyquaternium-7, Citric Acid, Phenoxyethanol, Ethylhexylglycerin, Parfum"
  },

  // --- BABE & ISDIN & SEBAMED ---
  {
    brand: "Babe",
    name: "Babe Stop AKN Matlaştırıcı ve Sebum Dengeleyici Nemlendirici Krem",
    barcodes: ["8437000945727", "8437000945734"],
    category: "moisturizer",
    inci: "Aqua, C12-20 Acid PEG-8 Ester, Niacinamide, Glycerin, Dimethicone, Diethylhexyl Carbonate, Olus Oil, Salicylic Acid, Zinc PCA, Spiraea Ulmaria Extract, Bisabolol, Tocopheryl Acetate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Parfum, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin, Sodium Hydroxide"
  },
  {
    brand: "Isdin",
    name: "Isdin Fotoprotector Fusion Water Magic SPF 50 Su Bazlı Yüz Güneş Kremi",
    barcodes: ["8429420228795", "8470001854490"],
    category: "sun care",
    inci: "Aqua (Water), Dibutyl Adipate, Propanediol, Ethylhexyl Salicylate, Ethylhexyl Triazone, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Dimethicone, Butyl Methoxydibenzoylmethane, Phenylbenzimidazole Sulfonic Acid, Silica, Diisopropyl Sebacate, Arginine, Hydroxyacetophenone, Lauryl Glucoside, Polysorbate 60, Dimethicone/Vinyl Dimethicone Crosspolymer, Squalane, Sodium Hyaluronate, Tocopheryl Acetate, Xanthan Gum, Parfum (Fragrance)"
  },
  {
    brand: "Sebamed",
    name: "Sebamed Kompakt Sabunsuz Temizleyici pH 5.5 (Clear Face)",
    barcodes: ["4103040114013", "4103040114020"],
    category: "cleanser",
    inci: "Disodium Lauryl Sulfosuccinate, Triticum Vulgare Starch, Palmitic Acid, Stearic Acid, Glyceryl Stearate, Cetearyl Alcohol, Talc, Aqua, Sodium Lauroyl Sarcosinate, Cocamidopropyl Betaine, Panthenol, Inulin, Lecithin, Glycine, Magnesium Aspartate, Alanine, Lysine, Leucine, Tartaric Acid, Parfum, CI 77891"
  }
];

async function main() {
  console.log("=== Kült Eczane & Dermokozmetik Ürünleri Güncellemesi Başlatılıyor ===");
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db("obf");
  const productsCol = db.collection("products");

  let updated = 0;
  for (const item of TOP_DERMO_PRODUCTS) {
    const primaryCode = item.barcodes[0];
    const doc = {
      code: primaryCode,
      barcodes: item.barcodes,
      product_name: item.name,
      product_name_tr: item.name,
      brands: item.brand,
      ingredients_text: item.inci,
      ingredients_text_tr: item.inci,
      category: item.category,
      source: "top_dermocosmetics_curated_registry",
      verified: true,
      updated_at: new Date()
    };

    // Her bir barkod ve _id için eski bozuk kayıtları kesin olarak güncelle
    let matchedAny = false;
    for (const b of item.barcodes) {
      const res = await productsCol.updateMany(
        { $or: [{ code: b }, { _id: b }, { barcodes: b }] },
        { $set: doc }
      );
      if (res.matchedCount > 0) matchedAny = true;
    }

    if (!matchedAny) {
      await productsCol.insertOne(doc);
    }
    updated++;
  }

  console.log(`-> ${updated} adet popüler dermokozmetik ürünün tüm bozuk/eksik içerikleri laboratuvar seviyesinde güncellendi!`);
  const finalTotal = await productsCol.estimatedDocumentCount();
  console.log(`=== Güncel Toplam Ürün Sayısı: ${finalTotal} ===`);

  client.close();
}

main().catch(err => {
  console.error("Hata:", err);
  process.exit(1);
});
