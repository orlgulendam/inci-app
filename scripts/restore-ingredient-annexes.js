// scripts/restore-ingredient-annexes.js
// ingredients koleksiyonundaki eksik `eu_annex` alanını data/glossary.flagged.json kaynağından geri yükler.
//
// Sorun: Koleksiyondaki 30.394 kaydın HİÇBİRİNDE `eu_annex` yok (import sırasında kaybolmuş;
// kalıntısı `flags.annex_notes: "Annex: [object Object]"` dizesinde görülüyor).
// Bu yüzden koruyucu / renklendirici / UV-filtre etiketleri ve Annex II-VI referansları boş dönüyor.
//
// Bu betik SİLME YAPMAZ: yalnızca `eu_annex` ekler, `flags.is_*` değerlerini kaynakla eşitler
// ve bozuk `annex_notes` dizesini temizler. Tekrar çalıştırılması güvenlidir (idempotent).
//
// Kullanım:
//   node scripts/restore-ingredient-annexes.js --dry-run   (hiçbir şey yazmaz, sadece raporlar)
//   node scripts/restore-ingredient-annexes.js             (uygular)

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const config = require("../src/core/config/env");

const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE = path.resolve(__dirname, "../data/glossary.flagged.json");

// MongoIngredientRepository.normalizeKey ile aynı normalizasyon
function normalizeKey(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Domain katmanının (Ingredient entity) beklediği eu_annex şekli
function buildEuAnnex(src) {
  // Kaynakta eu_annex bazı kayıtlarda null (undefined değil); varsayılan parametre yetmiyor.
  const s = src || {};
  const list = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);
  return {
    annex2: list(s.annex2),
    annex3: list(s.annex3),
    preservative: list(s.preservative),
    colorant: list(s.colorant),
    uv_filter: list(s.uv_filter)
  };
}

(async () => {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Kaynak sözlük bulunamadı: ${SOURCE}`);
    process.exit(1);
  }

  console.log(`Kaynak okunuyor: ${SOURCE}`);
  const items = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  console.log(`  ${items.length} kayıt yüklendi.`);

  // Normalize edilmiş ada göre kaynak haritası
  const source = new Map();
  for (const item of items) {
    const key = normalizeKey(item.name || item.inci_name || item.key);
    if (key) source.set(key, item);
  }
  console.log(`  ${source.size} benzersiz normalize edilmiş ad.`);

  const client = await MongoClient.connect(config.mongo.uri);
  const col = client.db(config.mongo.dbName).collection("ingredients");

  const docs = await col
    .find({}, { projection: { inci_name: 1, name: 1, normalized_name: 1, flags: 1, eu_annex: 1 } })
    .toArray();
  console.log(`\nKoleksiyonda ${docs.length} kimyasal var.`);

  const operations = [];
  const stats = { matched: 0, unmatched: 0, annexAdded: 0, flagsChanged: 0, notesCleaned: 0 };

  for (const doc of docs) {
    const key = doc.normalized_name || normalizeKey(doc.inci_name || doc.name);
    const src = source.get(key);

    if (!src) {
      stats.unmatched++;
      continue;
    }
    stats.matched++;

    const set = {};
    const unset = {};

    // 1) Eksik eu_annex'i ekle
    if (!doc.eu_annex) {
      set.eu_annex = buildEuAnnex(src.eu_annex);
      stats.annexAdded++;
    }

    // 2) Regülasyon bayraklarını kaynakla eşitle (koleksiyonun is_* adlandırmasını koruyarak)
    const current = doc.flags || {};
    const srcFlags = src.flags || {};
    const srcAnnex = src.eu_annex || {}; // null olabilir
    const desired = {
      is_banned: !!srcFlags.banned,
      is_restricted: !!srcFlags.restricted,
      is_allergen: !!srcFlags.allergen,
      is_preservative: Array.isArray(srcAnnex.preservative) && srcAnnex.preservative.length > 0,
      is_colorant: Array.isArray(srcAnnex.colorant) && srcAnnex.colorant.length > 0,
      is_uv_filter: Array.isArray(srcAnnex.uv_filter) && srcAnnex.uv_filter.length > 0
    };

    let flagsChanged = false;
    for (const [field, value] of Object.entries(desired)) {
      if (!!current[field] !== value) {
        set[`flags.${field}`] = value;
        flagsChanged = true;
      }
    }
    if (flagsChanged) stats.flagsChanged++;

    // 3) Bozuk "Annex: [object Object]" dizesini kaldır
    if (typeof current.annex_notes === "string" && current.annex_notes.includes("[object Object]")) {
      unset["flags.annex_notes"] = "";
      stats.notesCleaned++;
    }

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) continue;

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    operations.push({ updateOne: { filter: { _id: doc._id }, update } });
  }

  console.log("\n=== RAPOR ===");
  console.log(`  kaynakta eşleşen      : ${stats.matched}`);
  console.log(`  kaynakta bulunamayan  : ${stats.unmatched}`);
  console.log(`  eu_annex eklenecek    : ${stats.annexAdded}`);
  console.log(`  bayrağı düzeltilecek  : ${stats.flagsChanged}`);
  console.log(`  annex_notes temizlenecek: ${stats.notesCleaned}`);
  console.log(`  toplam güncelleme     : ${operations.length}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: hiçbir değişiklik yazılmadı.");
    if (operations.length) {
      console.log("Örnek işlem:", JSON.stringify(operations[0], null, 2));
    }
    await client.close();
    return;
  }

  if (operations.length === 0) {
    console.log("\nGüncellenecek bir şey yok.");
    await client.close();
    return;
  }

  console.log("\nYazılıyor...");
  let written = 0;
  const BATCH = 1000;
  for (let i = 0; i < operations.length; i += BATCH) {
    const res = await col.bulkWrite(operations.slice(i, i + BATCH), { ordered: false });
    written += res.modifiedCount;
    console.log(`  ${Math.min(i + BATCH, operations.length)}/${operations.length} ... (${written} doküman değişti)`);
  }

  console.log("\n=== DOĞRULAMA ===");
  console.log("  eu_annex olan            :", await col.countDocuments({ eu_annex: { $exists: true } }));
  console.log("  flags.is_banned = true   :", await col.countDocuments({ "flags.is_banned": true }));
  console.log("  flags.is_restricted=true :", await col.countDocuments({ "flags.is_restricted": true }));
  console.log("  flags.is_allergen = true :", await col.countDocuments({ "flags.is_allergen": true }));
  console.log("  koruyucu (Annex V)       :", await col.countDocuments({ "eu_annex.preservative.0": { $exists: true } }));
  console.log("  renklendirici (Annex IV) :", await col.countDocuments({ "eu_annex.colorant.0": { $exists: true } }));
  console.log("  UV filtre (Annex VI)     :", await col.countDocuments({ "eu_annex.uv_filter.0": { $exists: true } }));
  console.log("  bozuk annex_notes kalan  :", await col.countDocuments({ "flags.annex_notes": /\[object Object\]/ }));

  await client.close();
  console.log("\nTamamlandı.");
})().catch((err) => {
  console.error("HATA:", err);
  process.exit(1);
});
