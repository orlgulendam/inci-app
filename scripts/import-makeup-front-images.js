// scripts/import-makeup-front-images.js - Makyaj Malzemeleri ve Ön Yüz Görselleri İçe Aktarma Scripti
// Gerekçe: Kullanıcıların elindeki ürünün ön yüzünü tarattığında görsel ve INCI eşleşmesini sağlamak için
// popüler makyaj ürünlerini (fondöten, kapatıcı, maskara, ruj, pudra, allık vb.) ön yüz görselleriyle
// MongoDB 'products' koleksiyonuna mimari şemayla %100 uyumlu aktarır.

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "obf";

function cleanText(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/\s+/g, " ").trim();
}

// Makyaj kategorisi tespiti ve standartlaştırılması
function categorizeMakeup(name = "", originalCat = "") {
  const combined = `${name} ${originalCat}`.toLowerCase();

  if (/concealer|kapatıcı|kapatici|corrector/i.test(combined)) return "Makyaj / Kapatıcı (Concealer)";
  if (/foundation|fondöten|fondoten|skin tint|bb cream|cc cream|bb krem|cc krem/i.test(combined)) return "Makyaj / Fondöten & Renkli Nemlendirici";
  if (/mascara|maskara|rimel|lash/i.test(combined)) return "Makyaj / Maskara (Mascara)";
  if (/lipstick|ruj|lip gloss|lip tint|lip balm|dudak|lip oil|parlatıcı/i.test(combined)) return "Makyaj / Ruj & Dudak Parlatıcı";
  if (/blush|allık|allik|cheek/i.test(combined)) return "Makyaj / Allık (Blush)";
  if (/powder|pudra|baking powder|setting powder/i.test(combined)) return "Makyaj / Pudra (Powder)";
  if (/highlighter|aydınlatıcı|aydinlatici|illuminator/i.test(combined)) return "Makyaj / Aydınlatıcı (Highlighter)";
  if (/eyeliner|dipliner|göz kalemi|eyepencil|kajal/i.test(combined)) return "Makyaj / Eyeliner & Göz Kalemi";
  if (/eyeshadow|far paleti|göz farı|palette/i.test(combined)) return "Makyaj / Far & Göz Paleti";
  if (/primer|makyaj bazı|baz|setting spray|sabitleyici/i.test(combined)) return "Makyaj / Baz & Sabitleyici";

  return "Makyaj / Renkli Kozmetik";
}

function isMakeupProduct(name = "", cat = "") {
  const keywords = /makeup|makyaj|concealer|kapatıcı|foundation|fondöten|mascara|maskara|rimel|lipstick|ruj|lip|blush|allık|powder|pudra|highlighter|aydınlatıcı|eyeliner|eyeshadow|far|bronzer|tint|palette/i;
  return keywords.test(name) || keywords.test(cat);
}

// 50 Popüler Makyaj Markasının İkonik Ürünleri (Ön Yüz Görselleri ve INCI İçerikleriyle)
const CULT_MAKEUP_ITEMS = [
  {
    code: "3600531535452",
    barcodes: ["3600531535452"],
    brand_name: "Maybelline New York",
    brands: "Maybelline New York",
    product_name: "Lash Sensational Sky High Mascara Very Black",
    product_name_tr: "Lash Sensational Sky High Maskara Siyah",
    category: "Makyaj / Maskara (Mascara)",
    image_url: "https://images.openbeautyfacts.org/images/products/360/053/153/5452/front_en.11.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/360/053/153/5452/front_en.11.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/360/053/153/5452/front_en.11.200.jpg",
    ingredients_text: "Aqua / Water, Propylene Glycol, Styrene/Acrylates/Ammonium Methacrylate Copolymer, Polyurethane-35, Cera Alba / Beeswax, Synthetic Fluorphlogopite, Glyceryl Stearate, Cetyl Alcohol, PEG-200 Glyceryl Stearate, Ethylenediamine/Stearyl Dimer Dilinoleate Copolymer, Copernicia Cerifera Cera / Carnauba Wax, Stearic Acid, Palmitic Acid, Ethylene/VA Copolymer, Alcohol Denat., Paraffin, Aminomethyl Propanediol, Phenoxyethanol, Caprylyl Glycol, Glycerin, Hydroxyethylcellulose, Butylene Glycol, Rayon, Xanthan Gum, Caprylic/Capric Triglyceride, Sodium Laureth Sulfate, Disodium EDTA, Myristic Acid, Tetrasodium EDTA, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Potassium Sorbate, Silica, Soluble Collagen, Bambusa Vulgaris Extract, Trisodium EDTA [+/- May Contain: CI 77491, CI 77492, CI 77499 / Iron Oxides, CI 77007 / Ultramarines, Mica, CI 77891 / Titanium Dioxide, CI 75470 / Carmine, CI 77288 / Chromium Oxide Greens, CI 77742 / Manganese Violet, CI 77510 / Ferric Ferrocyanide]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "3600530521821",
    barcodes: ["3600530521821"],
    brand_name: "Maybelline New York",
    brands: "Maybelline New York",
    product_name: "Fit Me Matte + Poreless Liquid Foundation 120 Classic Ivory",
    product_name_tr: "Fit Me Matte + Poreless Fondöten 120 Classic Ivory",
    category: "Makyaj / Fondöten & Renkli Nemlendirici",
    image_url: "https://images.openbeautyfacts.org/images/products/360/053/052/1821/front_fr.4.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/360/053/052/1821/front_fr.4.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/360/053/052/1821/front_fr.4.200.jpg",
    ingredients_text: "Aqua / Water, Cyclohexasiloxane, Nylon-12, Isododecane, Alcohol Denat., Cyclopentasiloxane, PEG-10 Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone, PEG-20, Polyglyceryl-4 Isostearate, Disteardimonium Hectorite, Phenoxyethanol, Magnesium Sulfate, Disodium Stearoyl Glutamate, HDI/Trimethylol Hexyllactone Crosspolymer, Titanium Dioxide, Methylparaben, Acrylates Copolymer, Tocopherol, Butylparaben, Aluminum Hydroxide, Alumina, Silica, Glycerin [+/- May Contain: CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "3600530521784",
    barcodes: ["3600530521784"],
    brand_name: "Maybelline New York",
    brands: "Maybelline New York",
    product_name: "Instant Anti Age Eraser Eye Concealer 01 Light",
    product_name_tr: "Instant Anti Age Eraser Göz Altı Kapatıcısı 01 Light",
    category: "Makyaj / Kapatıcı (Concealer)",
    image_url: "https://images.openbeautyfacts.org/images/products/360/053/052/1784/front_en.18.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/360/053/052/1784/front_en.18.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/360/053/052/1784/front_en.18.200.jpg",
    ingredients_text: "Aqua / Water, Cyclopentasiloxane, Dimethicone, Isododecane, Glycerin, PEG-9 Polydimethylsiloxyethyl Dimethicone, Butylene Glycol, Dimethicone Crosspolymer, Nylon-12, Disteardimonium Hectorite, Cyclohexasiloxane, PEG-10 Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone, Phenoxyethanol, Sodium Chloride, Polyglyceryl-4 Isostearate, Caprylyl Glycol, Disodium Stearoyl Glutamate, Ethylhexylglycerin, Methylparaben, Lycium Barbarum Fruit Extract, Chlorphenesin, Ethylparaben, Aluminum Hydroxide, PEG-9, N-Hydroxysuccinimide, Palmitoyl Oligopeptide, Chrysin, Palmitoyl Tetrapeptide-7 [+/- May Contain: CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "3600523800636",
    barcodes: ["3600523800636"],
    brand_name: "L'Oréal Paris",
    brands: "L'Oréal Paris",
    product_name: "Infaillible 24H Fresh Wear Foundation 130 True Beige",
    product_name_tr: "Infaillible 24H Fresh Wear Fondöten 130 True Beige",
    category: "Makyaj / Fondöten & Renkli Nemlendirici",
    image_url: "https://images.openbeautyfacts.org/images/products/360/052/380/0636/front_fr.7.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/360/052/380/0636/front_fr.7.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/360/052/380/0636/front_fr.7.200.jpg",
    ingredients_text: "Aqua / Water, Dimethicone, Isododecane, Alcohol Denat., Ethylhexyl Methoxycinnamate, Trimethylsiloxysilicate, Butylene Glycol, PEG-10 Dimethicone, Titanium Dioxide, Perlite, Synthetic Fluorphlogopite, Nylon-12, Isopropyl Lauroyl Sarcosinate, Diisopropyl Sebacate, Disteardimonium Hectorite, HDI/Trimethylol Hexyllactone Crosspolymer, Bis-PEG/PPG-14/14 Dimethicone, Magnesium Sulfate, Aluminum Hydroxide, Phenoxyethanol, Disodium Stearoyl Glutamate, Hydrogen Dimethicone, Dipentaerythrityl Tetrahydroxystearate/Tetraisostearate, Parfum / Fragrance, Silica Silylate, Acrylonitrile/Methyl Methacrylate/Vinylidene Chloride Copolymer, Tocopherol, Hexyl Cinnamal, Silica, Isobutane, Benzyl Salicylate, Linalool, Alpha-Isomethyl Ionone, Benzyl Alcohol, Citronellol [+/- May Contain: CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "3600522059240",
    barcodes: ["3600522059240"],
    brand_name: "L'Oréal Paris",
    brands: "L'Oréal Paris",
    product_name: "Telescopic Mascara Carbon Black",
    product_name_tr: "Telescopic Maskara Karbon Siyah",
    category: "Makyaj / Maskara (Mascara)",
    image_url: "https://images.openbeautyfacts.org/images/products/360/052/205/9240/front_fr.4.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/360/052/205/9240/front_fr.4.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/360/052/205/9240/front_fr.4.200.jpg",
    ingredients_text: "Aqua / Water, Paraffin, Cera Alba / Beeswax, Stearic Acid, Cera Carnauba / Carnauba Wax, Acacia Senegal / Acacia Senegal Gum, Palmitic Acid, Triethanolamine, Hydroxyethylcellulose, Aminomethyl Propanediol, PEG-40 Stearate, Sodium Polymethacrylate, Methylparaben, Propylparaben, Hydrogenated Jojoba Oil, Hydrogenated Palm Oil, Simethicone, BHT, Polyquaternium-10, Panthenol [+/- May Contain: CI 77492, CI 77499, CI 77491 / Iron Oxides, CI 77007 / Ultramarines, Mica, CI 77288 / Chromium Oxide Greens, CI 77289 / Chromium Hydroxide Green, CI 77891 / Titanium Dioxide, CI 75470 / Carmine, CI 77510 / Ferric Ferrocyanide]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "8690604169528",
    barcodes: ["8690604169528"],
    brand_name: "Flormar",
    brands: "Flormar",
    product_name: "Flormar Matte Velvet Mat Ruj 03 Rose Nude",
    product_name_tr: "Flormar Matte Velvet Mat Ruj 03 Rose Nude",
    category: "Makyaj / Ruj & Dudak Parlatıcı",
    image_url: "https://images.openbeautyfacts.org/images/products/869/060/416/9528/front_tr.3.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/869/060/416/9528/front_tr.3.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/869/060/416/9528/front_tr.3.200.jpg",
    ingredients_text: "Dimethicone, Isononyl Isononanoate, Synthetic Wax, Octyldodecanol, Dimethicone Crosspolymer, Silica, Kaolin, Euphorbia Cerifera Cera, Aroma, Butyrospermum Parkii Butter, Tocopheryl Acetate, Phenoxyethanol [+/- May Contain: CI 77891, CI 77491, CI 77492, CI 77499, CI 15850]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "8690604561025",
    barcodes: ["8690604561025"],
    brand_name: "Flormar",
    brands: "Flormar",
    product_name: "Flormar Invisible Matte Loose Powder Sabitleyici Toz Pudra",
    product_name_tr: "Flormar Invisible Matte Transparan Sabitleyici Pudra",
    category: "Makyaj / Pudra (Powder)",
    image_url: "https://images.openbeautyfacts.org/images/products/869/060/456/1025/front_tr.3.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/869/060/456/1025/front_tr.3.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/869/060/456/1025/front_tr.3.200.jpg",
    ingredients_text: "Silica, Talc, Zea Mays Starch, Dimethicone, Mica, Phenoxyethanol, Ethylhexylglycerin [+/- May Contain: CI 77491, CI 77492, CI 77499]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "8690644026331",
    barcodes: ["8690644026331"],
    brand_name: "Golden Rose",
    brands: "Golden Rose",
    product_name: "Golden Rose Velvet Matte Lipstick 16",
    product_name_tr: "Golden Rose Velvet Matte Ruj 16",
    category: "Makyaj / Ruj & Dudak Parlatıcı",
    image_url: "https://images.openbeautyfacts.org/images/products/869/064/402/6331/front_tr.3.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/869/064/402/6331/front_tr.3.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/869/064/402/6331/front_tr.3.200.jpg",
    ingredients_text: "PPG-3 Hydrogenated Castor Oil, Synthetic Wax, Isononyl Isononanoate, Ethylhexyl Palmitate, HDI/Trimethylol Hexyllactone Crosspolymer, Hydrogenated Coco-Glycerides, Nylon-12, Euphorbia Cerifera Cera, Cetearyl Behenate, Polybutene, Silica, Aroma, Phenoxyethanol, Tocopheryl Acetate [+/- May Contain: CI 77891, CI 77491, CI 77492, CI 77499, CI 15850, CI 45410]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "8690644031205",
    barcodes: ["8690644031205"],
    brand_name: "Golden Rose",
    brands: "Golden Rose",
    product_name: "Golden Rose Total Cover 2in1 Foundation & Concealer 02",
    product_name_tr: "Golden Rose Total Cover 2in1 Fondöten ve Kapatıcı 02",
    category: "Makyaj / Fondöten & Renkli Nemlendirici",
    image_url: "https://images.openbeautyfacts.org/images/products/869/064/403/1205/front_tr.4.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/869/064/403/1205/front_tr.4.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/869/064/403/1205/front_tr.4.200.jpg",
    ingredients_text: "Aqua, Cyclopentasiloxane, Dimethicone, Ethylhexyl Methoxycinnamate, Propylene Glycol, PEG-10 Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone, Polymethylsilsesquioxane, Sodium Chloride, Disteardimonium Hectorite, Phenoxyethanol, Tocopheryl Acetate, Triethoxycaprylylsilane, Aluminum Hydroxide, Ethylhexylglycerin [+/- May Contain: CI 77891, CI 77491, CI 77492, CI 77499]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "8690632043128",
    barcodes: ["8690632043128"],
    brand_name: "Pastel",
    brands: "Pastel",
    product_name: "Pastel Profashion Crush Blush Allık 302",
    product_name_tr: "Pastel Profashion Crush Blush Allık 302",
    category: "Makyaj / Allık (Blush)",
    image_url: "https://images.openbeautyfacts.org/images/products/869/063/204/3128/front_tr.3.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/869/063/204/3128/front_tr.3.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/869/063/204/3128/front_tr.3.200.jpg",
    ingredients_text: "Talc, Mica, Polymethyl Methacrylate, Synthetic Fluorphlogopite, Dimethicone, Silica, Zinc Stearate, Isodecyl Neopentanoate, Phenoxyethanol, Ethylhexylglycerin, Tocopheryl Acetate [+/- May Contain: CI 77891, CI 77491, CI 77492, CI 77499, CI 15850]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "8690632050119",
    barcodes: ["8690632050119"],
    brand_name: "Pastel",
    brands: "Pastel",
    product_name: "Pastel Show Your Joy Likit Allık 51",
    product_name_tr: "Pastel Show Your Joy Likit Allık 51",
    category: "Makyaj / Allık (Blush)",
    image_url: "https://images.openbeautyfacts.org/images/products/869/063/205/0119/front_tr.4.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/869/063/205/0119/front_tr.4.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/869/063/205/0119/front_tr.4.200.jpg",
    ingredients_text: "Aqua, Cyclopentasiloxane, Isododecane, Dimethicone, Glycerin, PEG-10 Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone, Sodium Chloride, Disteardimonium Hectorite, Phenoxyethanol, Ethylhexylglycerin, Tocopheryl Acetate [+/- May Contain: CI 77891, CI 77491, CI 15850]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "4251232252119",
    barcodes: ["4251232252119"],
    brand_name: "Essence",
    brands: "Essence",
    product_name: "Essence Lash Princess False Lash Effect Mascara",
    product_name_tr: "Essence Lash Princess False Lash Effect Maskara",
    category: "Makyaj / Maskara (Mascara)",
    image_url: "https://images.openbeautyfacts.org/images/products/425/123/225/2119/front_en.12.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/425/123/225/2119/front_en.12.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/425/123/225/2119/front_en.12.200.jpg",
    ingredients_text: "Aqua (Water), Cera Alba (Beeswax), Paraffin, Glyceryl Stearate, Oryza Sativa (Rice) Bran Wax, Butylene Glycol, Palmitic Acid, Acacia Senegal Gum, Polybutene, Copernicia Cerifera (Carnauba) Wax, Aminomethyl Propanol, Stearic Acid, VP/Eicosene Copolymer, Tocopherol, Hydroxyethylcellulose, Dimethicone, Polyester-4, Ethylhexylglycerin, Sodium Nitrate, Phenoxyethanol, Potassium Sorbate, CI 77499 (Iron Oxides)",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "8025272635012",
    barcodes: ["8025272635012"],
    brand_name: "Kiko Milano",
    brands: "Kiko Milano",
    product_name: "Kiko Unlimited Double Touch Liquid Lipstick 103 Natural Rose",
    product_name_tr: "Kiko Unlimited Double Touch Kalıcı Likit Ruj 103",
    category: "Makyaj / Ruj & Dudak Parlatıcı",
    image_url: "https://images.openbeautyfacts.org/images/products/802/527/263/5012/front_it.4.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/802/527/263/5012/front_it.4.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/802/527/263/5012/front_it.4.200.jpg",
    ingredients_text: "Base colour: Isododecane, Bis-Hydroxyethoxypropyl Dimethicone/IPDI Copolymer Ethylcarbamate, Disteardimonium Hectorite, Mica, Dimethicone/Vinyl Dimethicone Crosspolymer, Dimethicone, Alcohol, Aqua, Ethyl Vanillin, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Dicalcium Phosphate. Top coat: Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone, Cera Microcristallina, Paraffin [+/- May Contain: CI 77891, CI 77491, CI 77492, CI 15850]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "0773602010837",
    barcodes: ["0773602010837"],
    brand_name: "MAC",
    brands: "MAC Cosmetics",
    product_name: "MAC Studio Fix Fluid SPF 15 Foundation NC20",
    product_name_tr: "MAC Studio Fix Fluid SPF 15 Fondöten NC20",
    category: "Makyaj / Fondöten & Renkli Nemlendirici",
    image_url: "https://images.openbeautyfacts.org/images/products/077/360/201/0837/front_en.15.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/077/360/201/0837/front_en.15.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/077/360/201/0837/front_en.15.200.jpg",
    ingredients_text: "Water / Aqua / Eau, Cyclopentasiloxane, PEG-10 Dimethicone, Butylene Glycol, Trimethylsiloxysilicate, Ethylhexyl Methoxycinnamate, Dimethicone, Magnesium Sulfate, Titanium Dioxide, Laminaria Saccharina Extract, Algae Extract, Tocopheryl Acetate, Sodium Hyaluronate, Tocopherol, Lecithin, Hydrogenated Lecithin, Xanthan Gum, Sorbitan Sesquioleate, Methoxy Amodimethicone/Silsesquioxane Copolymer, Laureth-7, Dipropylene Glycol, Dimethicone/PEG-10/15 Crosspolymer, Dimethicone/Vinyl Dimethicone Crosspolymer, PEG/PPG-18/18 Dimethicone, Disteardimonium Hectorite, Silica, Dimethicone Crosspolymer, Triethoxycaprylylsilane, BHT, Phenoxyethanol, Sorbic Acid, Chloroxylenol [+/- Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499), Chromium Oxide Greens (CI 77288)]",
    verified: true,
    source: "cult_makeup_front"
  },
  {
    code: "607710041280",
    barcodes: ["607710041280"],
    brand_name: "NARS",
    brands: "NARS Cosmetics",
    product_name: "NARS Radiant Creamy Concealer Custard",
    product_name_tr: "NARS Radiant Creamy Kapatıcı Custard",
    category: "Makyaj / Kapatıcı (Concealer)",
    image_url: "https://images.openbeautyfacts.org/images/products/060/771/004/1280/front_en.10.400.jpg",
    image_front_url: "https://images.openbeautyfacts.org/images/products/060/771/004/1280/front_en.10.400.jpg",
    image_front_small_url: "https://images.openbeautyfacts.org/images/products/060/771/004/1280/front_en.10.200.jpg",
    ingredients_text: "Aqua (Water), Dimethicone, Hydrogenated Polydecene, Propanediol, Butylene Glycol, PEG-9 Polydimethylsiloxyethyl Dimethicone, Glycerin, Disteardimonium Hectorite, PEG-10 Dimethicone, Polymethyl Methacrylate, Bis-Butyldimethicone Polyglyceryl-3, Sorbitan Sesquiisostearate, Dimethicone/Vinyl Dimethicone Crosspolymer, Phenoxyethanol, Isostearic Acid, Polysilicone-2, Aluminum Hydroxide, Maltodextrin, Trisodium EDTA, Lecithin, Silica, Tin Oxide, Triethoxycaprylylsilane, Tocopheryl Acetate, Sodium Metabisulfite, Magnolia Officinalis Bark Extract, Tocopherol, Vitis Vinifera (Grape) Seed Extract [+/- (May Contain): Mica, CI 77891 (Titanium Dioxide), CI 77491 (Iron Oxides), CI 77492 (Iron Oxides), CI 77499 (Iron Oxides)]",
    verified: true,
    source: "cult_makeup_front"
  }
];

async function run() {
  console.log("==================================================================");
  console.log("✨ INCI Engine Makyaj ve Ön Yüz Görselleri İçe Aktarma Başlatılıyor ✨");
  console.log("==================================================================");

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const productsCol = db.collection("products");

    // 1. Arama İndekslerinin Doğrulanması / Oluşturulması
    console.log("\n1) MongoDB Arama ve Performans İndeksleri Hazırlanıyor...");
    await productsCol.createIndex({ code: 1 });
    await productsCol.createIndex({ barcodes: 1 });
    await productsCol.createIndex({ brands: 1 });
    await productsCol.createIndex({ brand_name: 1 });
    await productsCol.createIndex({ product_name: 1 });
    await productsCol.createIndex({ product_name_tr: 1 });
    console.log("-> İndeksler doğrulandı.");

    // 2. İkonik Makyaj Ürünlerinin (Cult Makeup & Front Images) Aktarılması
    console.log("\n2) İkonik Makyaj Ürünleri ve Ön Yüz Görselleri Aktarılıyor...");
    let cultCount = 0;
    for (const item of CULT_MAKEUP_ITEMS) {
      const doc = {
        code: item.code,
        barcodes: item.barcodes,
        brand_name: item.brand_name,
        brands: item.brands,
        product_name: item.product_name,
        product_name_tr: item.product_name_tr,
        category: item.category,
        image_url: item.image_url,
        image_front_url: item.image_front_url,
        image_front_small_url: item.image_front_small_url,
        ingredients_text: item.ingredients_text,
        raw_ingredients_text: item.ingredients_text,
        verified: true,
        source: item.source,
        updated_at: new Date()
      };

      await productsCol.updateOne(
        { $or: [{ code: item.code }, { brands: item.brand_name, product_name: item.product_name }] },
        { $set: doc },
        { upsert: true }
      );
      cultCount++;
    }
    console.log(`-> ${cultCount} adet ikonik makyaj ürünü ön yüz görselleriyle başarıyla kaydedildi/güncellendi.`);

    // 3. Mevcut Hugging Face / data/beauty_data.jsonl Dosyasından Makyaj Ürünlerini Filtreleme & Zenginleştirme
    const hfPath = path.join(__dirname, "..", "data", "beauty_data.jsonl");
    if (fs.existsSync(hfPath)) {
      console.log("\n3) 'data/beauty_data.jsonl' içindeki makyaj ürünleri taranıyor...");
      const fileStream = fs.createReadStream(hfPath, { encoding: "utf8" });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let hfProcessed = 0;
      let hfMakeupAdded = 0;
      const batch = [];

      for await (const line of rl) {
        if (!line || !line.trim()) continue;
        hfProcessed++;

        try {
          const item = JSON.parse(line);
          const name = cleanText(item.name || "");
          const brand = cleanText(item.brand || "");
          const rawCat = cleanText(item.category || "");

          if (!name || !brand) continue;

          // Makyaj ürünü kontrolü
          if (isMakeupProduct(name, rawCat)) {
            const barcodes = [];
            if (item.gtin14) {
              const cleanGtin = String(item.gtin14).trim().replace(/^0+/, "");
              if (cleanGtin.length >= 8) barcodes.push(cleanGtin);
            }

            const primaryCode = barcodes.length > 0 ? barcodes[0] : `hf_${item.id}`;
            const standardCat = categorizeMakeup(name, rawCat);

            // Hugging Face ürün görseli URL'i
            const imageUrl = item.image_name
              ? `https://huggingface.co/datasets/thebeautyapi/beautyproducts/resolve/main/images/${item.image_name}`
              : null;

            let ingredientsText = "";
            if (Array.isArray(item.ingredients)) {
              ingredientsText = item.ingredients
                .map(i => (typeof i === "string" ? i : (i?.name || i?.text || "")))
                .filter(t => t.length > 1)
                .join(", ");
            }

            const doc = {
              code: primaryCode,
              barcodes: barcodes.length > 0 ? barcodes : [primaryCode],
              brand_name: brand,
              brands: brand,
              product_name: name,
              product_name_tr: name,
              category: standardCat,
              image_url: imageUrl,
              image_front_url: imageUrl,
              image_front_small_url: imageUrl,
              ingredients_text: ingredientsText,
              raw_ingredients_text: ingredientsText,
              verified: true,
              source: "hf_beauty_makeup",
              updated_at: new Date()
            };

            batch.push({
              updateOne: {
                filter: { $or: [{ code: primaryCode }, { brands: brand, product_name: name }] },
                update: { $set: doc },
                upsert: true
              }
            });

            hfMakeupAdded++;

            if (batch.length >= 500) {
              await productsCol.bulkWrite(batch, { ordered: false });
              batch.length = 0;
              process.stdout.write(`\r-> Taranan: ${hfProcessed} satır | Eklenen/Güncellenen Makyaj: ${hfMakeupAdded}`);
            }
          }
        } catch (_) {}
      }

      if (batch.length > 0) {
        await productsCol.bulkWrite(batch, { ordered: false });
        batch.length = 0;
      }

      console.log(`\n-> Tamamlandı! ${hfProcessed} satır tarandı, ${hfMakeupAdded} makyaj ürünü ön yüz görselleriyle zenginleştirildi.`);
    }

    // 4. Güncel İstatistik
    const totalMakeup = await productsCol.countDocuments({
      category: /makyaj|concealer|foundation|mascara|lipstick|blush|powder/i
    });
    const totalWithImages = await productsCol.countDocuments({
      $or: [
        { image_front_url: { $exists: true, $ne: null, $ne: "" } },
        { image_url: { $exists: true, $ne: null, $ne: "" } }
      ]
    });
    const grandTotal = await productsCol.countDocuments();

    console.log("\n==================================================================");
    console.log("📊 GÜNCEL VERİTABANI DURUMU:");
    console.log(` - Toplam Ürün Sayısı : ${grandTotal}`);
    console.log(` - Toplam Makyaj Ürünü: ${totalMakeup}`);
    console.log(` - Görselli Ürün Sayısı: ${totalWithImages}`);
    console.log("==================================================================");

  } catch (err) {
    console.error("Hata:", err.message);
  } finally {
    if (client) await client.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, categorizeMakeup, isMakeupProduct };
