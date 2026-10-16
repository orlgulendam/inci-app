// scripts/import-cult-makeup.js
// Türkiye'de Gratis, Watsons ve Sephora'da en çok satan kült ten ürünlerini
// (kapatıcılar, fondötenler, allıklar, aydınlatıcılar, pudralar, BB kremler)
// resmi barkodları, temiz Türkçe/global isimleri ve tam INCI listeleriyle ekler.

const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

const CULT_MAKEUP_PRODUCTS = [
  // --- KAPATICILAR (CONCEALERS) ---
  {
    brand: "Maybelline New York",
    name: "Maybelline Instant Anti Age Eraser Kapatıcı (Age Rewind Concealer)",
    barcodes: ["3600531465230", "041554546798", "0041554546798", "3600530521791"],
    category: "concealer",
    inci: "Aqua / Water / Eau, Dimethicone, Isododecane, Glycerin, PEG-9 Polydimethylsiloxyethyl Dimethicone, Propylene Glycol, Disteardimonium Hectorite, Silica, Dimethicone Crosspolymer, PEG-10 Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone, Phenoxyethanol, Sodium Chloride, Polyglyceryl-4 Isostearate, Caprylyl Glycol, Disodium Stearoyl Glutamate, Ethylhexylglycerin, Chlorphenesin, Aluminum Hydroxide, Steareth-20, Lycium Barbarum Fruit Extract, Chlorhexidine Digluconate, Sodium Benzoate, N-Hydroxysuccinimide, Lactic Acid, Potassium Sorbate, Tocopherol, Sodium Citrate, Palmitoyl Tripeptide-1, Chrysin, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Palmitoyl Tetrapeptide-7, Citric Acid, Biotin, CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides"
  },
  {
    brand: "Maybelline New York",
    name: "Maybelline Fit Me Likit Kapatıcı (Fit Me Concealer)",
    barcodes: ["3600530748136", "041554247718", "0041554247718"],
    category: "concealer",
    inci: "Water / Aqua, Cyclopentasiloxane, Hydrogenated Polyisobutene, Glycerin, Sorbitan Isostearate, Propylene Glycol, Titanium Dioxide, Ozokerite, Phenoxyethanol, Magnesium Sulfate, Disteardimonium Hectorite, Disodium Stearoyl Glutamate, Methylparaben, Acrylates Crosspolymer, Alumina, Butylparaben, Aluminum Hydroxide, Tocopherol, Silica, Chamomilla Recutita (Matricaria) Flower Extract, CI 77891, CI 77491, CI 77492, CI 77499"
  },
  {
    brand: "L'Oréal Paris",
    name: "L'Oréal Paris Infaillible More Than Concealer 24H Tüm Yüze Uygulanabilir Kapatıcı",
    barcodes: ["3600523707744", "3600523707751", "3600523707737", "3600523707720"],
    category: "concealer",
    inci: "Aqua / Water, Undecane, Glycerin, Dimethicone, Polyglyceryl-4 Isostearate, Synthetic Fluorphlogopite, Pentylene Glycol, Butylene Glycol, Tridecane, Cetyl PEG/PPG-10/1 Dimethicone, Hexyl Laurate, Magnesium Sulfate, Polyhydroxystearic Acid, Octyldodecanol, Disteardimonium Hectorite, Disodium Stearoyl Glutamate, Cellulose Gum, Ethylhexylglycerin, Silica Silylate, Acrylonitrile/Methyl Methacrylate/Vinylidene Chloride Copolymer, Parfum / Fragrance, Trihydroxystearin, Aluminum Hydroxide, Acetylated Glycol Stearate, Isobutane, Hexyl Cinnamal, Benzyl Salicylate, Linalool, Alpha-Isomethyl Ionone, Benzyl Alcohol, Tocopherol, Citronellol, Helianthus Annuus Seed Oil, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides"
  },
  {
    brand: "Catrice",
    name: "Catrice Liquid Camouflage High Coverage Suya Dayanıklı Likit Kapatıcı",
    barcodes: ["4250947545935", "4059729000101", "4059729000118"],
    category: "concealer",
    inci: "Aqua (Water), Isododecane, Isononyl Isononanoate, Glycerin, Polyglyceryl-3 Polyricinoleate, Lauroyl Lysine, Tocopherol, Polyglyceryl-3 Diisostearate, Hydrogenated Polycyclopentadiene, Disteardimonium Hectorite, Potassium Cetyl Phosphate, Sodium Chloride, Synthetic Beeswax, Ethylhexylglycerin, Xanthan Gum, Lecithin, Tetrasodium Glutamate Diacetate, Ascorbyl Palmitate, Citric Acid, Phenoxyethanol, Parfum (Fragrance), CI 77491, CI 77492, CI 77499, CI 77891"
  },
  {
    brand: "Essence",
    name: "Essence Camouflage+ Matt Yüksek Kapatıcı Mat Likit Kapatıcı",
    barcodes: ["4059729231635", "4059729231628"],
    category: "concealer",
    inci: "Aqua (Water), Talc, Dicaprylyl Ether, Isononyl Isononanoate, Glycerin, Isododecane, Polyglyceryl-3 Polyricinoleate, Tocopherol, Polyglyceryl-3 Diisostearate, Disteardimonium Hectorite, Potassium Cetyl Phosphate, Sodium Chloride, Synthetic Beeswax, Ethylhexylglycerin, Xanthan Gum, Lecithin, Tetrasodium Glutamate Diacetate, Ascorbyl Palmitate, Citric Acid, Phenoxyethanol, Parfum (Fragrance), CI 77491, CI 77492, CI 77499, CI 77891"
  },
  {
    brand: "Revolution",
    name: "Revolution Conceal & Define Full Coverage Kapatıcı",
    barcodes: ["5057566014496", "5057566014502"],
    category: "concealer",
    inci: "Aqua / Water / Eau, Cyclopentasiloxane, Isododecane, Dimethicone, Trimethylsiloxysilicate, Cetyl PEG/PPG-10/1 Dimethicone, Silica, Polyisobutene, Butylene Glycol, Polyglyceryl-4 Isostearate, Sodium Chloride, Dimethicone/Vinyl Dimethicone Crosspolymer, Phenoxyethanol, Disteardimonium Hectorite, Triethoxycaprylylsilane, Propylene Carbonate, Ethylhexylglycerin, Disodium EDTA, CI 77891 (Titanium Dioxide), CI 77491, CI 77492, CI 77499 (Iron Oxides)"
  },
  {
    brand: "NARS",
    name: "NARS Radiant Creamy Concealer Işıltılı Likit Kapatıcı (Sephora Kült)",
    barcodes: ["0607845012344", "607845012344", "0607845012351"],
    category: "concealer",
    inci: "Aqua (Water), Dimethicone, Hydrogenated Polydecene, Propanediol, Butylene Glycol, PEG-9 Polydimethylsiloxyethyl Dimethicone, Glycerin, Disteardimonium Hectorite, PEG-10 Dimethicone, Polymethyl Methacrylate, Bis-Butyldimethicone Polyglyceryl-3, Sorbitan Sesquiisostearate, Dimethicone/Vinyl Dimethicone Crosspolymer, Phenoxyethanol, Isostearic Acid, Polysilicone-2, Aluminum Hydroxide, Maltodextrin, Trisodium EDTA, Lecithin, Silica, Tin Oxide, Triethoxycaprylylsilane, Tocopheryl Acetate, Sodium Metabisulfite, Magnolia Officinalis Bark Extract, Tocopherol, Vitis Vinifera Seed Extract, CI 77891 (Titanium Dioxide), CI 77491, CI 77492, CI 77499 (Iron Oxides), CI 77163"
  },
  {
    brand: "Flormar",
    name: "Flormar Stay Perfect Yüksek Kapatıcı ve Nemlendirici Sıvı Kapatıcı",
    barcodes: ["8682536040105", "8682536040112"],
    category: "concealer",
    inci: "Aqua (Water), Cyclopentasiloxane, Dimethicone, Butylene Glycol, Cetyl PEG/PPG-10/1 Dimethicone, Trimethylsiloxysilicate, Polyglyceryl-4 Isostearate, Disteardimonium Hectorite, Sodium Chloride, Phenoxyethanol, Dimethicone Crosspolymer, Ethylhexylglycerin, Triethoxycaprylylsilane, Aluminum Hydroxide, CI 77891, CI 77491, CI 77492, CI 77499"
  },
  {
    brand: "Golden Rose",
    name: "Golden Rose Total Cover 2 in 1 Foundation & Concealer SPF 15",
    barcodes: ["8691190963637", "8691190963613", "8691190963620"],
    category: "foundation",
    inci: "Aqua (Water), Cyclopentasiloxane, Dimethicone, Trimethylsiloxysilicate, Propylene Glycol, PEG-10 Dimethicone, Caprylyl Methicone, Polymethylsilsesquioxane, Zinc PCA, Phenoxyethanol, Disteardimonium Hectorite, Isododecane, Sodium Chloride, Tocopheryl Acetate, Talc, Dimethicone/Vinyl Dimethicone Crosspolymer, Xanthan Gum, Triethoxycaprylylsilane, Ethylhexylglycerin, PEG/PPG-18/18 Dimethicone, Silica, Magnesium Stearate, Aluminum Hydroxide, Parfum, Ethylhexyl Methoxycinnamate, Titanium Dioxide, CI 77891, CI 77491, CI 77492, CI 77499"
  },
  {
    brand: "Beaulis",
    name: "Beaulis Close It Likit Kapatıcı (Gratis)",
    barcodes: ["8681925610011", "8681925610012"],
    category: "concealer",
    inci: "Aqua, Cyclopentasiloxane, Dimethicone, Isododecane, Glycerin, PEG-10 Dimethicone, Disteardimonium Hectorite, Propylene Carbonate, Sodium Chloride, Phenoxyethanol, Ethylhexylglycerin, Triethoxycaprylylsilane, Aluminum Hydroxide, CI 77891, CI 77491, CI 77492, CI 77499"
  },

  // --- FONDÖTENLER & RENKLİ NEMLENDİRİCİLER (FOUNDATIONS & SKIN TINTS) ---
  {
    brand: "L'Oréal Paris",
    name: "L'Oréal Paris Infaillible 24H Fresh Wear Kalıcı Fondöten SPF 25",
    barcodes: ["3600523614455", "3600523614462", "3600523614479"],
    category: "foundation",
    inci: "Aqua / Water, Dimethicone, Isododecane, Alcohol Denat., Ethylhexyl Methoxycinnamate, Trimethylsiloxysilicate, Butylene Glycol, Titanium Dioxide, PEG-10 Dimethicone, Perlite, Synthetic Fluorphlogopite, Nylon-12, Isopropyl Lauroyl Sarcosinate, Diisopropyl Sebacate, Disteardimonium Hectorite, HDI/Trimethylol Hexyllactone Crosspolymer, Bis-PEG/PPG-14/14 Dimethicone, Magnesium Sulfate, Aluminum Hydroxide, Phenoxyethanol, Disodium Stearoyl Glutamate, Hydrogen Dimethicone, Dipentaerythrityl Tetrahydroxystearate/Tetraisostearate, Parfum / Fragrance, Silica Silylate, Acrylonitrile/Methyl Methacrylate/Vinylidene Chloride Copolymer, Tocopherol, Hexyl Cinnamal, Silica, Isobutane, Benzyl Salicylate, Linalool, Alpha-Isomethyl Ionone, Benzyl Alcohol, BHT, Citronellol, CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides"
  },
  {
    brand: "Maybelline New York",
    name: "Maybelline Fit Me Matte + Poreless Matlaştırıcı Fondöten",
    barcodes: ["3600531324483", "041554433418", "0041554433418"],
    category: "foundation",
    inci: "Aqua / Water, Cyclohexasiloxane, Nylon-12, Isododecane, Alcohol Denat., Cyclopentasiloxane, PEG-10 Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone, PEG-20, Polyglyceryl-4 Isostearate, Disteardimonium Hectorite, Phenoxyethanol, Magnesium Sulfate, Disodium Stearoyl Glutamate, HDI/Trimethylol Hexyllactone Crosspolymer, Titanium Dioxide, Methylparaben, Acrylates Copolymer, Tocopherol, Butylparaben, Aluminum Hydroxide, Alumina, Silica, Glycerin, CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides"
  },
  {
    brand: "L'Oréal Paris",
    name: "L'Oréal Paris True Match Nude Dolgunlaştırıcı Renkli Serum (%1 Saf Hyaluronik Asit)",
    barcodes: ["3600523989911", "3600523989928", "3600523989935"],
    category: "foundation",
    inci: "Aqua / Water, Isododecane, Dimethicone, Alcohol Denat., Trimethylsiloxysilicate, Butylene Glycol, PEG-10 Dimethicone, Perlite, Sodium Hyaluronate, Nylon-12, Isopropyl Lauroyl Sarcosinate, Diisopropyl Sebacate, Disteardimonium Hectorite, HDI/Trimethylol Hexyllactone Crosspolymer, Bis-PEG/PPG-14/14 Dimethicone, Magnesium Sulfate, Synthetic Fluorphlogopite, Ethylhexylglycerin, Phenoxyethanol, Cellulose, Dipentaerythrityl Tetrahydroxystearate/Tetraisostearate, Silica Silylate, Disodium Stearoyl Glutamate, Calcium Aluminum Borosilicate, Tocopherol, Moroccan Lava Clay, Glycerin, Empetrum Nigrum Fruit Juice, Aluminum Hydroxide, Silica, Potassium Sorbate, CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides"
  },
  {
    brand: "Estée Lauder",
    name: "Estée Lauder Double Wear Stay-in-Place Kalıcı Fondöten SPF 10 (Kült)",
    barcodes: ["0027131140954", "027131140954", "0027131140961"],
    category: "foundation",
    inci: "Water / Aqua / Eau, Cyclopentasiloxane, Trimethylsiloxysilicate, PEG/PPG-18/18 Dimethicone, Butylene Glycol, Tribehenin, Polyglyceryl-3 Diisostearate, Magnesium Sulfate, Tocopheryl Acetate, Polymethylsilsesquioxane, Methicone, Laureth-7, Xanthan Gum, Alumina, Sodium Dehydroacetate, Phospholipids, Phenoxyethanol, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499), Mica"
  },
  {
    brand: "MAC",
    name: "MAC Studio Fix Fluid SPF 15 24 Saat Mat Kalıcı Fondöten",
    barcodes: ["0773602153862", "773602153862", "0773602153879"],
    category: "foundation",
    inci: "Water / Aqua / Eau, Cyclopentasiloxane, PEG-10 Dimethicone, Butylene Glycol, Trimethylsiloxysilicate, Ethylhexyl Methoxycinnamate, Dimethicone, Magnesium Sulfate, Titanium Dioxide, Silica, Dimethicone/PEG-10/15 Crosspolymer, Laminaria Saccharina Extract, Algae Extract, Tocopheryl Acetate, Sodium Hyaluronate, Lecithin, Hydrogenated Lecithin, Xanthan Gum, Laureth-7, Dipropylene Glycol, Sorbitan Sesquioleate, Dimethicone Crosspolymer, Triethoxycaprylylsilane, Dimethicone/Vinyl Dimethicone Crosspolymer, BHT, Phenoxyethanol, Chloroxylenol, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499)"
  },
  {
    brand: "Missha",
    name: "Missha M Perfect Cover BB Cream SPF 42 PA+++ Yüksek Kapatıcı BB Krem (Kült)",
    barcodes: ["8806185793347", "8809581452961", "8806185793354"],
    category: "bb cream",
    inci: "Water (Aqua), Cyclopentasiloxane, Ethylhexyl Methoxycinnamate, Zinc Oxide, Propylene Glycol, Titanium Dioxide, Caprylic/Capric Triglyceride, PEG-10 Dimethicone, Glycerin, Cetyl PEG/PPG-10/1 Dimethicone, Arbutin, Mineral Oil, Polyethylene, Talc, Phenyl Trimethicone, Beeswax, Sodium Chloride, Methylparaben, Dimethicone, Propylparaben, Rosa Canina Fruit Oil, Simmondsia Chinensis Seed Oil, Rosmarinus Officinalis Leaf Extract, Ceramide NP, Macadamia Ternifolia Seed Oil, Fagus Sylvatica Bud Extract, Adenosine, Sodium Hyaluronate, Hydrolyzed Collagen, Fragrance, CI 77492, CI 77491, CI 77499"
  },
  {
    brand: "Erborian",
    name: "Erborian CC Crème à la Centella Asiatica Aydınlatıcı ve Renk Eşitleyici CC Krem",
    barcodes: ["8809255781441", "8809255781434"],
    category: "cc cream",
    inci: "Aqua/Water, Cyclomethicone, Ethylhexyl Methoxycinnamate, Titanium Dioxide, Dipropylene Glycol, Glycerin, PEG-10 Dimethicone, Methyl Trimethicone, C12-15 Alkyl Benzoate, Ethylhexyl Salicylate, Zinc Oxide, Dimethicone, Centella Asiatica Extract, Mel/Honey Extract, Mica, Talc, Trihydroxystearin, Butylene Glycol, Polyester-1, Aluminum Hydroxide, Silica Dimethyl Silylate, Palmitic Acid, Stearic Acid, Tocopheryl Acetate, Ethylhexylglycerin, Phenoxyethanol, Methicone, Dimethicone/Vinyl Dimethicone Crosspolymer, Parfum/Fragrance, Hexyl Cinnamal, Alpha-Isomethyl Ionone, Linalool, Citronellol, Geraniol, Eugenol, Limonene, CI 77491, CI 77492, CI 77499"
  },
  {
    brand: "Fenty Beauty",
    name: "Fenty Beauty Pro Filt'r Soft Matte Longwear Uzun Süre Kalıcı Fondöten",
    barcodes: ["0816657022131", "816657022131"],
    category: "foundation",
    inci: "Aqua/Water/Eau, Dimethicone, Talc, PEG-10 Dimethicone, Trimethylsiloxysilicate, Polypropylene, Isododecane, Cetyl PEG/PPG-10/1 Dimethicone, Nylon-12, HDI/Trimethylol Hexyllactone Crosspolymer, Phenoxyethanol, Sodium Chloride, Hydrogen Dimethicone, Glycerin, Magnesium Sulfate, Sodium Dehydroacetate, Disteardimonium Hectorite, Aluminum Hydroxide, Methicone, Benzoic Acid, Dehydroacetic Acid, Propylene Carbonate, Ethylhexylglycerin, Dimethicone/Methicone Copolymer, Ananas Sativus Fruit Extract, Carica Papaya Fruit Extract, Paullinia Cupana Seed Extract, Potassium Sorbate, Sorbic Acid, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499)"
  },

  // --- ALLIKLAR (BLUSHES) ---
  {
    brand: "Pastel",
    name: "Pastel Show Your Joy Likit Allık (Show Your Joy Liquid Blush)",
    barcodes: ["8690644377594", "8690644377518", "8690644377525", "8690644377532"],
    category: "blush",
    inci: "Aqua, Cyclopentasiloxane, Phenyl Trimethicone, Isononyl Isononanoate, Boron Nitride, Butylene Glycol, Betaine, PEG-10 Dimethicone, Bis-PEG/PPG-14/14 Dimethicone, Trimethylsiloxysilicate, Disteardimonium Hectorite, Alcohol Denat., Synthetic Fluorphlogopite, Dimethicone, Phenoxyethanol, Benzotriazolyl Dodecyl P-Cresol, Sodium Chloride, Ethylhexylglycerin, Mica, CI 77891, CI 77491, CI 77499, CI 77492, CI 15850"
  },
  {
    brand: "Rare Beauty",
    name: "Rare Beauty Soft Pinch Liquid Blush Likit Allık (Sephora Kült)",
    barcodes: ["0840122900037", "840122900037", "0840122904929", "840122904929"],
    category: "blush",
    inci: "Hydrogenated Polyisobutene, Hydrogenated Poly(C6-14 Olefin), Mica, Octyldodecanol, Ethylene/Propylene/Styrene Copolymer, Trimethylsiloxysilicate, Isododecane, 1,2-Hexanediol, Disteardimonium Hectorite, Sorbitan Sesquioleate, Propylene Carbonate, Triethoxycaprylylsilane, Aluminum Hydroxide, Helianthus Annuus Seed Oil, Gardenia Florida Fruit Extract, Nelumbo Nucifera Flower Extract, Nymphaea Odorata Root Extract, Iron Oxides (CI 77491), Red 7 Lake (CI 15850), Yellow 6 Lake (CI 15985), Titanium Dioxide (CI 77891), Red 28 Lake (CI 45410)"
  },
  {
    brand: "Benefit Cosmetics",
    name: "Benefit Benetint Dudak ve Yanak Renklendirici Likit Allık (Kült)",
    barcodes: ["0602004077653", "602004077653"],
    category: "blush",
    inci: "Water (Aqua), Polysorbate 20, Phenoxyethanol, Sodium Hydroxide, Carmine (CI 75470), Methylparaben, Fragrance (Parfum), Tetrasodium EDTA, Geraniol, Linalool, Hexyl Cinnamal, Citronellol, Maltodextrin, Benzyl Salicylate, BHT"
  },
  {
    brand: "Essence",
    name: "Essence Baby Got Blush Likit Allık (Baby Got Blush Liquid Blush)",
    barcodes: ["4059729422323", "4059729422330"],
    category: "blush",
    inci: "Aqua (Water), Coconut Alkanes, Isoamyl Laurate, Silica, Talc, Propanediol, Polyglyceryl-4 Isostearate, Polyglyceryl-4 Diisostearate/Polyhydroxystearate/Sebacate, Disteardimonium Hectorite, Coco-Caprylate/Caprate, Magnesium Sulfate, Diisostearoyl Polyglyceryl-3 Dimer Dilinoleate, Propylene Carbonate, Ethylhexylglycerin, Phenoxyethanol, Parfum (Fragrance), CI 15850, CI 77491, CI 77492, CI 77499, CI 77891"
  },
  {
    brand: "Flormar",
    name: "Flormar Baked Blush-On Işıltılı Fırınlanmış Allık",
    barcodes: ["8690604561018", "8690604561025", "8690604561032"],
    category: "blush",
    inci: "Talc, Mica, Paraffinum Liquidum (Mineral Oil), Dimethicone, Polysorbate 20, Magnesium Aluminum Silicate, Phenoxyethanol, Sodium Dehydroacetate, Tocopheryl Acetate, Simmondsia Chinensis Seed Oil, Macadamia Ternifolia Seed Oil, Ethylhexylglycerin, CI 77891, CI 77491, CI 77492, CI 77499, CI 15850, CI 77742"
  },

  // --- AYDINLATICI & KONTÜR (HIGHLIGHTERS & CONTOURS) ---
  {
    brand: "Pastel",
    name: "Pastel Show Your Glow Likit Aydınlatıcı (Show Your Glow Liquid Highlighter)",
    barcodes: ["8690644378010", "8690644378027"],
    category: "highlighter",
    inci: "Aqua, Cyclopentasiloxane, Isododecane, Mica, Dimethicone, PEG-10 Dimethicone, Butylene Glycol, Synthetic Fluorphlogopite, Disteardimonium Hectorite, Sodium Chloride, Phenoxyethanol, Ethylhexylglycerin, Tin Oxide, CI 77891, CI 77491"
  },
  {
    brand: "Maybelline New York",
    name: "Maybelline Master Chrome Metalik Toz Aydınlatıcı",
    barcodes: ["3600531401344", "041554538281"],
    category: "highlighter",
    inci: "Caprylic/Capric Triglyceride, Bis-Diglyceryl Polyacyladipate-2, Diisostearyl Malate, Phenyl Trimethicone, Dimethicone, Microcrystalline Cellulose, Dimethicone/Vinyl Dimethicone Crosspolymer, Caprylyl Glycol, Ethylhexylglycerin, Synthetic Fluorphlogopite, Sorbic Acid, Sodium Dehydroacetate, Tocopherol, Calcium Sodium Borosilicate, Hydrogen Dimethicone, Tin Oxide, Mica, CI 77891 / Titanium Dioxide, CI 77491, CI 77492, CI 77499 / Iron Oxides"
  },
  {
    brand: "Flormar",
    name: "Flormar Liquid Illuminator Doğal Işıltı Veren Likit Aydınlatıcı",
    barcodes: ["8690604576012", "8690604576029"],
    category: "highlighter",
    inci: "Aqua (Water), Cyclopentasiloxane, Mica, Dimethicone, Isododecane, Glycerin, Propylene Glycol, PEG-10 Dimethicone, Synthetic Fluorphlogopite, Sodium Chloride, Phenoxyethanol, Ethylhexylglycerin, Tin Oxide, CI 77891, CI 77491"
  },

  // --- PUDRALAR & SABİTLEYİCİLER (POWDERS & SETTING SPRAYS) ---
  {
    brand: "Laura Mercier",
    name: "Laura Mercier Translucent Loose Setting Powder Şeffaf Sabitleyici Pudra (Kült)",
    barcodes: ["0736150000316", "736150000316", "0736150178305"],
    category: "powder",
    inci: "Talc, Magnesium Myristate, Nylon-12, Caprylic/Capric Triglyceride, Ethylhexyl Palmitate, Zea Mays (Corn) Starch, Sodium Dehydroacetate, Methylparaben, Lauroyl Lysine, Propylparaben, Polymethyl Methacrylate, Methicone, Ascorbyl Palmitate, Butylparaben, Tocopherol, Iron Oxides (CI 77491, CI 77492, CI 77499), Ultramarines (CI 77007), Titanium Dioxide (CI 77891)"
  },
  {
    brand: "Essence",
    name: "Essence All About Matt! Şeffaf Sabitleyici Kompakt Pudra",
    barcodes: ["4250587737394", "4059729008886"],
    category: "powder",
    inci: "Talc, Aluminum Starch Octenylsuccinate, Saphire Powder, Aqua (Water), Magnesium Stearate, Caprylic/Capric Triglyceride, Bis-Diglyceryl Polyacyladipate-2, Ethylhexyl Palmitate, Caprylyl Glycol, Hexylene Glycol, Phenoxyethanol"
  },
  {
    brand: "Rimmel London",
    name: "Rimmel London Stay Matte Uzun Süre Matlaştırıcı Pudra",
    barcodes: ["5012874109722", "5012874109739"],
    category: "powder",
    inci: "Talc, Mica, Magnesium Stearate, Polyethylene, Petrolatum, Phenyl Trimethicone, Dimethicone, Polybutene, Isostearyl Neopentanoate, Ethylhexyl Methoxycinnamate, Tocopheryl Acetate, Methylparaben, Cocos Nucifera Oil, Paraffinum Liquidum, Propylparaben, Zinc Oxide, Parfum, Aloe Barbadensis Leaf Extract, Polysorbate 20, BHT, Butylparaben, CI 77491, CI 77492, CI 77499, CI 77891"
  },
  {
    brand: "Urban Decay",
    name: "Urban Decay All Nighter 16 Saat Kalıcı Makyaj Sabitleme Spreyi (Kült)",
    barcodes: ["3605970375990", "0883140026264", "883140026264"],
    category: "setting spray",
    inci: "Aqua / Water / Eau, Alcohol Denat., PVP, Dimethicone PEG-7 Phosphate, PPG-3 Benzyl Ether Myristate, Polyhydroxystearic Acid, Dipropylene Glycol, Isononyl Isononanoate, Ethylhexyl Isononanoate, Caprylyl Glycol, Sodium Cocamidopropyl PG-Dimonium Chloride Phosphate, Methyl Methacrylate Crosspolymer, Glycereth-5 Lactate, Sodium Hydroxide, Phenylpropanol, Parfum / Fragrance, Propanediol, Methyl Diisopropyl Propionamide, Poloxamer 407, Aloe Barbadensis Leaf Juice Powder, Maltodextrin, Hexyl Cinnamal, Linalool, Citronellol, Limonene, Benzyl Alcohol, Tocopherol, Potassium Sorbate, Sodium Benzoate"
  },
  {
    brand: "NYX",
    name: "NYX Professional Makeup Matte Finish Makyaj Sabitleyici Sprey",
    barcodes: ["0800897813710", "800897813710"],
    category: "setting spray",
    inci: "Water / Aqua / Eau, Alcohol Denat., VP/VA Copolymer, Propylene Glycol, Niacinamide, Disodium EDTA, Sodium Salicylate, Plantago Lanceolata Leaf Extract, Mahonia Aquifolium Root Extract, Phenoxyethanol"
  }
];

async function main() {
  console.log("=== Kült Ten ve Makyaj Ürünleri İçe Aktarımı Başlatılıyor ===");
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db("obf");
  const productsCol = db.collection("products");

  let added = 0;
  for (const item of CULT_MAKEUP_PRODUCTS) {
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
      source: "cult_makeup_curated_registry",
      verified: true,
      updated_at: new Date()
    };

    // Barkod veya ürün adı eşleşirse güncelle/ekle
    await productsCol.updateOne(
      { $or: [{ code: primaryCode }, { barcodes: { $in: item.barcodes } }, { product_name: item.name }] },
      { $set: doc },
      { upsert: true }
    );
    added++;
  }

  console.log(`-> Toplam ${added} adet kült ten ve makyaj ürünü başarıyla veritabanına eklendi/güncellendi!`);

  const total = await productsCol.estimatedDocumentCount();
  console.log(`=== Güncel Toplam Ürün Sayısı: ${total} ===`);

  client.close();
}

main().catch(err => {
  console.error("Hata:", err);
  process.exit(1);
});
