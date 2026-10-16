// scripts/06-functions.js
// AB CosIng Envanteri (cosing-inventory.csv) -> Görevler (Fonksiyonlar), CAS No ve Açıklamaları çekme -> Türkçe Çeviriler & Zengin Açıklamalar -> ingredients.flagged.json & glossary.flagged.json
// Çalıştır:  node scripts/06-functions.js
const fs = require("fs");

const INVENTORY_CSV = "data/cosing-inventory.csv";
const DRAFT_FILE = "data/ingredients.flagged.json";
const GLOSSARY_FILE = "data/glossary.flagged.json";

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// ---------- 1) Fonksiyonların Türkçe Sözlüğü ----------
const FUNCTION_MAP_TR = {
  "SKIN CONDITIONING": "Cilt Bakımı & Besleyici",
  "EMOLLIENT": "Cilt Yumuşatıcı",
  "HUMECTANT": "Nemlendirici (Su Tutucu)",
  "SKIN PROTECTING": "Cilt Koruyucu",
  "ANTIOXIDANT": "Antioksidan",
  "SURFACTANT": "Yüzey Aktif Madde",
  "CLEANSING": "Temizleyici & Arındırıcı",
  "EMULSIFYING": "Emülgatör (Kıvam Birleştirici)",
  "SOLVENT": "Çözücü & Taşıyıcı",
  "PRESERVATIVE": "Koruyucu",
  "UV ABSORBER": "Güneş / UV Filtresi",
  "UV FILTER": "Güneş / UV Filtresi",
  "COSMETIC COLORANT": "Renklendirici / Pigment",
  "PERFUMING": "Koku / Parfüm Bileşeni",
  "ASTRINGENT": "Gözenek Sıkılaştırıcı",
  "EXFOLIATING": "Peeling / Ölü Deri Arındırıcı",
  "ABRASIVE": "Pürüz Giderici",
  "SOOTHING": "Yatıştırıcı & Sakinleştirici",
  "HAIR CONDITIONING": "Saç Bakımı & Yumuşatıcı",
  "ANTISTATIC": "Elektriklenme Önleyici",
  "VISCOSITY CONTROLLING": "Kıvam Artırıcı",
  "FILM FORMING": "Film Oluşturucu",
  "ANTISEBORRHOEIC": "Sebum / Yağ Dengeleyici",
  "TONIC": "Cilt Canlandırıcı & Tonik",
  "BLEACHING": "Cilt Aydınlatıcı",
  "DEODORANT": "Koku Önleyici",
  "BUFFERING": "pH Dengeleyici",
  "MASKING": "Koku Maskeleyici",
  "FOAMING": "Köpük Oluşturucu",
  "FOAM BOOSTING": "Köpük Artırıcı",
  "ANTIMICROBIAL": "Antimikrobiyal",
  "ANTIPERSPIRANT": "Terleme Önleyici",
  "BINDING": "Bağlayıcı",
  "BULKING": "Hacim Artırıcı",
  "CHELATING": "Şelat Ajanı (Mineral Bağlayıcı)",
  "HAIR DYEING": "Saç Boyası",
  "HAIR FIXING": "Saç Şekillendirici",
  "KERATOLYTIC": "Hücre Yenileyici (Keratolitik)",
  "OPACIFYING": "Matlaştırıcı / Opaklaştırıcı",
  "REFRESHING": "Ferahlatıcı",
  "SMOOTHING": "Pürüzsüzleştirici & Cilt Düzeltici",
  "FLAVOURING": "Aroma / Tatlandırıcı",
  "ORAL CARE": "Ağız & Diş Bakımı",
  "ANTIPLAQUE": "Plak Önleyici",
  "PROPELLANT": "İtici Gaz",
  "ANTICAKING": "Topaklanma Önleyici",
  "MOISTURISING": "Nemlendirici",
  "EMULSION STABILISING": "Emülsiyon Dengeleyici",
  "STABILISING": "Formül Sabitleyici",
  "ANTIDANDRUFF": "Kepek Önleyici",
  "REFATTING": "Yağ Dengeleyici & Besleyici",
  "TANNING": "Bronzlaştırıcı",
  "ABSORBENT": "Emici (Yağ/Nem Absorbanı)"
};

// ---------- 2) En Popüler Süperstar İçeriklerin Özel Türkçe Açıklamaları ----------
const SUPERSTAR_NOTES = {
  "aqua": "Kozmetik formüllerin temel çözücüsü ve taşıyıcısıdır; saflaştırılmış sudur.",
  "glycerin": "Ciltte doğal olarak bulunan, havadan ve derin katmanlardan su çekerek cildi dolgunlaştıran en etkili doğal nemlendiricidir.",
  "niacinamide": "B3 Vitamini formudur; gözenekleri sıkılaştırır, cilt tonu eşitsizliklerini giderir, sebumu dengeler ve cilt bariyerini güçlendirir.",
  "sodium hyaluronate": "Hyaluronik Asit tuzudur; kendi ağırlığının 1000 katı kadar su tutarak cildi neme doyurur ve ince çizgileri dolgunlaştırır.",
  "hyaluronic acid": "Cildin doğal yapıtaşıdır; cilde esneklik, dolgunluk ve derinlemesine nem kazandırır.",
  "salicylic acid": "Beta Hidroksi Asit (BHA); gözeneklerin içine nüfuz ederek birikmiş yağı ve ölü deriyi temizler, siyah nokta ve sivilceleri önler.",
  "glycolic acid": "Alfa Hidroksi Asit (AHA); cilt yüzeyindeki ölü hücreleri arındırarak cildin daha parlak, pürüzsüz ve taze görünmesini sağlar.",
  "lactic acid": "Hafif ve nazik bir AHA; cildi hem nazikçe soyar hem de nemlendirerek cilt dokusunu yeniler.",
  "retinol": "Saf A Vitamini; kolajen üretimini tetikler, hücre yenilenmesini hızlandırır, kırışıklık ve leke görünümünü azaltır.",
  "squalane": "Cilt sebumunda doğal olarak bulunan hafif, gözenek tıkamayan üstün bir yumuşatıcıdır; bariyeri onarır ve nem kaybını önler.",
  "ceramide np": "Cilt bariyerinin en kritik lipitlerinden biridir; nemi hapseder ve cildi dış tahriş edicilere karşı kalkan gibi korur.",
  "ceramide ap": "Bariyer onarıcı temel seramid; cildin elastikiyetini artırır ve kuruluğu önler.",
  "ceramide eop": "Cilt hücrelerini bir arada tutan harç görevi görür; aşırı kuru ve hassas ciltleri onarır.",
  "panthenol": "Pro-Vitamin B5; tahriş olmuş cildi hızla yatıştırır, kızarıklığı alır, yara iyileşmesini ve bariyer onarımını destekler.",
  "allantoin": "Karakafes otundan elde edilen doğal yatıştırıcı; cildi sakinleştirir, yumuşatır ve tahrişi azaltır.",
  "caffeine": "Güçlü bir antioksidandır; kan dolaşımını hızlandırarak göz altı morluklarını, şişkinlikleri ve donuk görünümü azaltır.",
  "ascorbic acid": "Saf C Vitamini; serbest radikallerle savaşır, kolajen üretimini artırır ve koyu lekeleri aydınlatır.",
  "tocopherol": "Doğal E Vitamini; güçlü bir antioksidandır, cildi UV hasarından ve oksidatif stresten korur.",
  "tocopheryl acetate": "Kararlı E Vitamini formu; nemlendirir ve formüldeki diğer yağların bozulmasını önler.",
  "centella asiatica extract": "Gotu Kola (Madecassoside) özü; tahriş olmuş ve hassas cildi hızla sakinleştiren efsanevi Kore bakım aktifi.",
  "aloe barbadensis leaf juice": "Aloe Vera yaprak suyu; yanık, kuruluk ve tahrişte cildi anında ferahlatır ve nemlendirir.",
  "zinc pca": "Çinko bileşiğidir; sebum salgısını dengeler, sivilceye neden olan bakterileri baskılar ve kızarıklığı yatıştırır.",
  "butyrospermum parkii butter": "Shea Yağı; zengin yağ asitleri ve vitaminler içerir, kuru ciltleri derinlemesine besler ve yumuşatır.",
  "simmondsia chinensis seed oil": "Jojoba Yağı; insan cilt yağına (sebum) en yakın bitkisel yağdır, cildi yağlandırmadan dengeler.",
  "argania spinosa kernel oil": "Argan Yağı; E vitamini ve yağ asitlerince zengindir; cildi ve saçları besler, elastikiyet kazandırır.",
  "phenoxyethanol": "Modern kozmetikte paraben yerine yaygın kullanılan, ürünü bakteri ve küflere karşı koruyan güvenli koruyucudur.",
  "chlorphenesin": "Mantar ve mayalara karşı formülü koruyan güvenli bir antimikrobiyal koruyucudur.",
  "ethylhexylglycerin": "Cildi yumuşatırken koruyucu sistemlerin etkisini artıran doğal kaynaklı bir yardımcı koruyucudur.",
  "dimethicone": "Cilt üzerinde ipeksi, nefes alabilen bir koruyucu tabaka oluşturan ve nemi hapseden hafif bir silikondur.",
  "titanium dioxide": "Doğal mineral pigment ve UV filtresidir; hem kapatıcılık sağlar hem de güneş ışınlarını ciltten yansıtır.",
  "zinc oxide": "Doğal mineral güneş filtresidir; cildi UVA ve UVB ışınlarına karşı korurken aynı zamanda tahrişi yatıştırır."
};

// ---------- 3) CSV Ayrıştırıcı ----------
function parseCSV(text) {
  const rows = [];
  let cur = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field.trim()); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(field.trim());
        if (cur.some(Boolean)) rows.push(cur);
        cur = []; field = "";
      } else field += ch;
    }
  }
  if (field || cur.length) { cur.push(field.trim()); rows.push(cur); }
  return rows;
}

// ---------- 4) Otomatik Akıllı Türkçe Açıklama Üretici ----------
function generateNoteTR(name, functions, functionsTR) {
  const k = norm(name);
  if (k in SUPERSTAR_NOTES) return SUPERSTAR_NOTES[k];

  const fnSet = new Set(functions);

  // Bitkisel Yağlar
  if (k.includes("seed oil") || k.includes("kernel oil") || k.includes("fruit oil")) {
    return "Cildi derinlemesine besleyen, kuruluğu önleyen ve bariyeri yumuşatan zengin bitkisel yağ.";
  }
  // Bitkisel Ekstreler
  if (k.includes("extract") || k.includes("leaf extract") || k.includes("flower extract") || k.includes("root extract")) {
    if (fnSet.has("ANTIOXIDANT")) return "Cildi serbest radikallere karşı koruyan ve canlandıran antioksidan etkili bitkisel ekstre.";
    if (fnSet.has("SOOTHING")) return "Cildi sakinleştiren, tahrişi ve kızarıklığı azaltan yatıştırıcı doğal bitkisel ekstre.";
    return "Cildi besleyen, tazeleyen ve bakım sağlayan doğal bitkisel ekstre.";
  }
  // Güneş Filtreleri
  if (fnSet.has("UV FILTER") || fnSet.has("UV ABSORBER")) {
    return "Cildi zararlı güneş ışınlarına (UVA/UVB) karşı koruyan ultraviyole filtre bileşeni.";
  }
  // Koruyucular
  if (fnSet.has("PRESERVATIVE")) {
    return "Ürünü mikroorganizmalara, bakteri ve küf oluşumuna karşı koruyarak bozulmasını engelleyen koruyucu.";
  }
  // Nemlendiriciler
  if (fnSet.has("HUMECTANT")) {
    return "Cildin nem tutma kapasitesini artıran ve su kaybını engelleyen nemlendirici bileşen.";
  }
  // Cilt Yumuşatıcılar
  if (fnSet.has("EMOLLIENT")) {
    return "Cilt yüzeyini pürüzsüzleştiren, yumuşatan ve nemi cilde hapseden lipit içerik.";
  }
  // Temizleyiciler / Yüzey Aktifler
  if (fnSet.has("CLEANSING") || fnSet.has("SURFACTANT")) {
    return "Kir, fazla yağ ve makyaj kalıntılarını ciltten nazikçe arındıran temizleyici yüzey aktif madde.";
  }
  // Antioksidanlar
  if (fnSet.has("ANTIOXIDANT")) {
    return "Çevresel faktörlerin ve serbest radikallerin neden olduğu yaşlanma belirtilerine karşı koruyan antioksidan.";
  }
  // Parfüm / Koku
  if (fnSet.has("PERFUMING")) {
    return "Ürüne hoş koku kazandıran esans/koku bileşeni.";
  }
  // Renklendiriciler
  if (fnSet.has("COSMETIC COLORANT")) {
    return "Ürüne renk ve kapatıcılık kazandıran kozmetik pigment/renklendirici.";
  }

  if (functionsTR.length) {
    return `Formülde ${functionsTR.slice(0, 3).join(", ").toLowerCase()} amacıyla kullanılan kozmetik bileşen.`;
  }
  return "Kozmetik formüllerde cilt bakımı ve stabilite sağlayan yardımcı bileşen.";
}

// ---------- 5) CosIng Envanterini Yükle ----------
console.log("CosIng envanteri okunuyor...");
const raw = fs.readFileSync(INVENTORY_CSV, "utf8");
const rows = parseCSV(raw);

let headerIdx = -1;
for (let i = 0; i < rows.length; i++) {
  if (rows[i] && rows[i][0] && rows[i][0].includes("COSING Ref No")) {
    headerIdx = i;
    break;
  }
}
if (headerIdx < 0) { console.error("CosIng başlığı bulunamadı!"); process.exit(1); }

// INCI name -> { cas, functions, functionsTR, desc }
const inventoryMap = new Map();

for (let i = headerIdx + 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 2) continue;
  const rawName = r[1].trim();
  const k = norm(rawName);
  if (!k) continue;

  const cas = (r[4] || "").trim().replace(/^[- ]+$/, "");
  const desc = (r[6] || "").trim();
  const rawFunc = (r[8] || "").trim();

  const functions = [];
  const functionsTR = [];

  if (rawFunc) {
    for (const f of rawFunc.split(",")) {
      const cleanF = f.trim().toUpperCase();
      if (cleanF && !functions.includes(cleanF) && cleanF.length > 2 && cleanF.length < 35) {
        functions.push(cleanF);
        const tr = FUNCTION_MAP_TR[cleanF];
        if (tr && !functionsTR.includes(tr)) functionsTR.push(tr);
      }
    }
  }

  inventoryMap.set(k, {
    cas: cas || null,
    functions,
    functionsTR,
    desc
  });
}

console.log(`CosIng Envanterinde ${inventoryMap.size} adet madde işlendi.`);

// ---------- 6) Ürün Taslağını (3.308 Madde) Zenginleştir ----------
const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, "utf8"));
let draftUpdated = 0;

for (const it of draft) {
  const k = norm(it.inci_name);
  const inv = inventoryMap.get(k);

  if (inv) {
    it.cas = it.cas || inv.cas;
    it.functions = inv.functions.length ? inv.functions : (it.functions || []);
    it.functions_tr = inv.functionsTR;
    it.description_en = inv.desc || null;
    draftUpdated++;
  } else {
    it.functions = it.functions || [];
    it.functions_tr = [];
  }

  // Türkçe Açıklama Ata
  it.note_tr = generateNoteTR(it.inci_name, it.functions, it.functions_tr);
  it.note_source = (k in SUPERSTAR_NOTES) ? "curated" : (inv ? "cosing_auto" : "fallback");
}

fs.writeFileSync(DRAFT_FILE, JSON.stringify(draft, null, 1));
console.log(`Ürün Taslağı (${draft.length} madde): ${draftUpdated} tanesi CosIng görevleriyle zenginleştirildi.`);
console.log(`Tüm ${draft.length} içeriğe Türkçe açıklama (note_tr) ve görev (functions_tr) atandı.`);

// ---------- 7) Tam AB Sözlüğünü (30.418 Madde) Zenginleştir ----------
const glossary = JSON.parse(fs.readFileSync(GLOSSARY_FILE, "utf8"));
let glossaryUpdated = 0;

for (const g of glossary) {
  const inv = inventoryMap.get(g.key);
  if (inv) {
    g.cas = inv.cas;
    g.functions = inv.functions;
    g.functions_tr = inv.functionsTR;
    g.description_en = inv.desc || null;
    glossaryUpdated++;
  } else {
    g.functions = [];
    g.functions_tr = [];
  }
  g.note_tr = generateNoteTR(g.name, g.functions, g.functions_tr);
}

fs.writeFileSync(GLOSSARY_FILE, JSON.stringify(glossary, null, 1));
console.log(`Tam AB Sözlüğü (${glossary.length} madde): ${glossaryUpdated} tanesi CosIng görevleriyle zenginleştirildi.`);

// ---------- 8) Örnek Kayıtları Yazdır ----------
console.log("\n=== ÖRNEK ZENGİNLEŞTİRİLMİŞ İÇERİK KARTLARI ===");
const samples = ["niacinamide", "glycerin", "salicylic acid", "squalane", "phenoxyethanol", "ceramide np"];
for (const s of samples) {
  const item = draft.find(d => norm(d.inci_name) === s);
  if (item) {
    console.log(`\n🔹 ${item.inci_name} (CAS: ${item.cas || "—"})`);
    console.log(`   Görevler (TR): ${item.functions_tr.join(", ") || "Belirtilmemiş"}`);
    console.log(`   Açıklama (TR): ${item.note_tr}`);
    console.log(`   Güvenlik: Yasaklı=${item.flags.banned}, Kısıtlı=${item.flags.restricted}, Alerjen=${item.flags.allergen}`);
  }
}
