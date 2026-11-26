// tests/personalization/skinCompatibilityComedogenic.test.js - Komedojenik (Gözenek Tıkayıcı) Puanlama Testleri
// Odak: SkinCompatibilityEngine'in 6. kuralı (PORE_CLOGGING_RISK). Mevcut testler bu kuralı
// hiç kapsamıyordu; egzama, parfüm ve mantar aknesi kuralları tests/unit/personalization.test.js
// içinde doğrulanıyor.
//
// Kapsam: kuralın hangi cilt profillerinde devreye girdiği, bilinen yüksek riskli bileşenlerin
// gerçek etiket yazımlarıyla işaretlenmesi, bilinmeyen bileşende çökmeme, uyumluluk puanının
// aritmetiği ve risk eşikleri. Gerçek veritabanı veya ağ kullanılmaz; motor saf domain servisidir.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const SkinCompatibilityEngine = require("../../src/modules/personalization/domain/services/SkinCompatibilityEngine");
const SkinProfile = require("../../src/modules/personalization/domain/value-objects/SkinProfile");

// Gözenek tıkama riski yüksek, kuralın tanıdığı bileşenler.
const COMEDOGENIC_INGREDIENTS = [
  "Isopropyl Myristate",
  "Cocos Nucifera (Coconut) Oil",
  "Ethylhexyl Palmitate",
  "Myristyl Myristate"
];

const oilySkin = () => new SkinProfile({ skinType: "oily" });
const proneSkin = () => new SkinProfile({ skinType: "dry", conditions: ["comedogenic_prone"] });
const drySkin = () => new SkinProfile({ skinType: "dry" });

const poreWarnings = (report) => report.warnings.filter((w) => w.type === "PORE_CLOGGING_RISK");

describe("Komedojenik Puanlama: Kuralın Devreye Girme Koşulları", () => {
  test("Yağlı cilt tipinde gözenek tıkama uyarısı üretilmeli", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), ["Aqua", "Isopropyl Myristate"]);

    assert.equal(poreWarnings(report).length, 1);
    assert.equal(poreWarnings(report)[0].ingredient, "ISOPROPYL MYRISTATE");
  });

  test("comedogenic_prone cilt durumunda kural cilt tipinden bağımsız çalışmalı", () => {
    const report = SkinCompatibilityEngine.evaluate(proneSkin(), ["Aqua", "Isopropyl Myristate"]);

    assert.equal(poreWarnings(report).length, 1, "kuru ciltte bile akne eğilimi bildirilmişse uyarmalı");
  });

  test("Türkçe gönderilen 'yagli' cilt tipi de kuralı tetiklemeli", () => {
    const profile = new SkinProfile({ skinType: "yagli" });
    assert.equal(profile.skinType, "oily", "Türkçe cilt tipi İngilizce sabite eşlenmeli");

    const report = SkinCompatibilityEngine.evaluate(profile, ["Isopropyl Myristate"]);

    assert.equal(poreWarnings(report).length, 1);
  });

  test("Kuru ve normal ciltte gözenek tıkama uyarısı üretilmemeli", () => {
    for (const skinType of ["dry", "normal"]) {
      const report = SkinCompatibilityEngine.evaluate(new SkinProfile({ skinType }), COMEDOGENIC_INGREDIENTS);

      assert.equal(poreWarnings(report).length, 0, `${skinType} cilt için uyarı beklenmez`);
      assert.equal(report.compatibilityScore, 100);
    }
  });

  test("Uyarı MEDIUM önem derecesi ve açıklayıcı mesaj taşımalı", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), ["Ethylhexyl Palmitate"]);
    const [warning] = poreWarnings(report);

    assert.equal(warning.severity, "MEDIUM");
    assert.equal(warning.type, "PORE_CLOGGING_RISK");
    assert.match(warning.message, /gözenek/i);
    assert.ok(warning.message.includes("ETHYLHEXYL PALMITATE"), "mesaj bileşen adını içermeli");
  });
});

describe("Komedojenik Puanlama: Bilinen Yüksek Riskli Bileşenler", () => {
  test("Kuralın tanıdığı dört bileşenin tamamı işaretlenmeli", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), COMEDOGENIC_INGREDIENTS);

    assert.equal(poreWarnings(report).length, 4, "her yüksek riskli bileşen ayrı uyarı üretmeli");
    assert.deepEqual(poreWarnings(report).map((w) => w.ingredient), [
      "ISOPROPYL MYRISTATE",
      "COCOS NUCIFERA (COCONUT) OIL",
      "ETHYLHEXYL PALMITATE",
      "MYRISTYL MYRISTATE"
    ]);
  });

  test("Büyük/küçük harf ve fazla boşluk eşleşmeyi bozmamalı", () => {
    for (const spelling of ["isopropyl myristate", "ISOPROPYL MYRISTATE", "  Isopropyl Myristate  "]) {
      const report = SkinCompatibilityEngine.evaluate(oilySkin(), [spelling]);

      assert.equal(poreWarnings(report).length, 1, `${JSON.stringify(spelling)} eşleşmeli`);
    }
  });

  test("Hindistan cevizi yağının gerçek etiket yazımları yakalanmalı", () => {
    // Gerçek etiketlerde bileşen halk adıyla birlikte basılır; tam ad eşitliği bunu kaçırıyordu.
    for (const spelling of [
      "Cocos Nucifera (Coconut) Oil",
      "COCOS NUCIFERA OIL",
      "Cocos Nucifera Nut Oil"
    ]) {
      const report = SkinCompatibilityEngine.evaluate(oilySkin(), [spelling]);

      assert.equal(poreWarnings(report).length, 1, `${spelling} gözenek tıkayıcı sayılmalı`);
    }
  });

  test("Hindistan cevizinin yağ olmayan türevleri yanlış pozitif üretmemeli", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), [
      "Cocos Nucifera (Coconut) Fruit Extract",
      "Cocos Nucifera Water"
    ]);

    assert.equal(poreWarnings(report).length, 0, "yağ olmayan türevler gözenek tıkayıcı değildir");
    assert.equal(report.compatibilityScore, 100);
  });

  test("Analysis modülünden gelen bileşen nesneleri de okunmalı", () => {
    // AnalysisService.analyze() çıktısındaki items dizisi { inciName, clean, raw } taşır.
    const fromInci = SkinCompatibilityEngine.evaluate(oilySkin(), [{ inciName: "ISOPROPYL MYRISTATE" }]);
    const fromClean = SkinCompatibilityEngine.evaluate(oilySkin(), [{ clean: "Isopropyl Myristate" }]);
    const fromRaw = SkinCompatibilityEngine.evaluate(oilySkin(), [{ raw: "Isopropyl Myristate" }]);

    assert.equal(poreWarnings(fromInci).length, 1);
    assert.equal(poreWarnings(fromClean).length, 1);
    assert.equal(poreWarnings(fromRaw).length, 1);
  });
});

describe("Komedojenik Puanlama: Bilinmeyen ve Bozuk Bileşenler", () => {
  test("Bilinmeyen bileşen uyarı üretmemeli ve motoru çökertmemeli", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), [
      "Aqua",
      "Glycerin",
      "Unknownium Extract",
      "Zzztol"
    ]);

    assert.equal(poreWarnings(report).length, 0);
    assert.equal(report.compatibilityScore, 100);
    assert.equal(report.totalWarnings, 0);
  });

  test("Listede null veya undefined bulunması değerlendirmeyi çökertmemeli", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), [null, "Isopropyl Myristate", undefined, ""]);

    assert.equal(poreWarnings(report).length, 1, "geçerli bileşen yine değerlendirilmeli");
  });

  test("Alan taşımayan nesne ve sayısal değerler sessizce atlanmalı", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), [{}, 42, { inciName: 42 }, "Aqua"]);

    assert.equal(report.totalWarnings, 0);
    assert.equal(report.compatibilityScore, 100);
  });

  test("Boş liste ve liste verilmemesi tam uyum döndürmeli", () => {
    const empty = SkinCompatibilityEngine.evaluate(oilySkin(), []);
    const missing = SkinCompatibilityEngine.evaluate(oilySkin());

    for (const report of [empty, missing]) {
      assert.equal(report.compatibilityScore, 100);
      assert.equal(report.isCompatible, true);
      assert.equal(report.riskLevel, "LOW");
      assert.deepEqual(report.warnings, []);
    }
  });
});

describe("Komedojenik Puanlama: Uyumluluk Puanı ve Risk Eşikleri", () => {
  test("Her gözenek tıkayıcı bileşen puandan 10 düşmeli", () => {
    const expected = [100, 90, 80, 70, 60];

    for (let count = 0; count <= 4; count++) {
      const report = SkinCompatibilityEngine.evaluate(oilySkin(), COMEDOGENIC_INGREDIENTS.slice(0, count));

      assert.equal(report.compatibilityScore, expected[count], `${count} bileşen için puan`);
      assert.equal(report.totalWarnings, count);
    }
  });

  test("Risk seviyesi puan eşiklerine göre belirlenmeli", () => {
    const low = SkinCompatibilityEngine.evaluate(oilySkin(), COMEDOGENIC_INGREDIENTS.slice(0, 2));
    const moderate = SkinCompatibilityEngine.evaluate(oilySkin(), COMEDOGENIC_INGREDIENTS.slice(0, 3));

    assert.equal(low.compatibilityScore, 80);
    assert.equal(low.riskLevel, "LOW", "80 ve üzeri LOW olmalı");
    assert.equal(moderate.compatibilityScore, 70);
    assert.equal(moderate.riskLevel, "MODERATE", "50-79 arası MODERATE olmalı");
  });

  test("Puan 50'nin altına inince risk seviyesi HIGH olmalı", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), Array(6).fill("Isopropyl Myristate"));

    assert.equal(report.compatibilityScore, 40);
    assert.equal(report.riskLevel, "HIGH");
  });

  test("Puan asla negatife inmemeli", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), Array(30).fill("Isopropyl Myristate"));

    assert.equal(report.compatibilityScore, 0, "taban puan 0 olmalı");
    assert.equal(report.riskLevel, "HIGH");
    assert.equal(report.isCompatible, false);
  });

  test("70 puan sınırında ürün hâlâ uyumlu sayılmalı", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), COMEDOGENIC_INGREDIENTS.slice(0, 3));

    assert.equal(report.compatibilityScore, 70);
    assert.equal(report.isCompatible, true, "eşik dahil olmalı");
  });

  test("70 puanın altında ürün uyumsuz sayılmalı", () => {
    const report = SkinCompatibilityEngine.evaluate(oilySkin(), COMEDOGENIC_INGREDIENTS);

    assert.equal(report.compatibilityScore, 60);
    assert.equal(report.isCompatible, false);
  });

  test("Şahsi alerjen uyarısı yüksek puana rağmen ürünü uyumsuz yapmalı", () => {
    const profile = new SkinProfile({ skinType: "oily", allergicIngredients: ["ISOPROPYL MYRISTATE"] });

    const report = SkinCompatibilityEngine.evaluate(profile, ["Isopropyl Myristate"]);

    assert.ok(report.warnings.some((w) => w.severity === "CRITICAL"), "şahsi alerjen CRITICAL olmalı");
    assert.equal(report.isCompatible, false);
    assert.equal(poreWarnings(report).length, 1, "aynı bileşen gözenek riski de üretmeli");
    assert.equal(report.compatibilityScore, 40, "50 (alerjen) + 10 (gözenek) ceza uygulanmalı");
  });
});

describe("Komedojenik Puanlama: Belirlenimcilik", () => {
  test("Aynı profil ve formül her çağrıda aynı raporu üretmeli", () => {
    const formula = ["Aqua", "Isopropyl Myristate", "Glycerin", "Ethylhexyl Palmitate"];

    const first = SkinCompatibilityEngine.evaluate(oilySkin(), formula);
    const second = SkinCompatibilityEngine.evaluate(oilySkin(), formula);

    assert.deepEqual(first, second);
  });

  test("Bileşen sırası değişse de puan ve uyarı sayısı aynı kalmalı", () => {
    const ordered = SkinCompatibilityEngine.evaluate(oilySkin(), ["Aqua", "Isopropyl Myristate", "Myristyl Myristate"]);
    const shuffled = SkinCompatibilityEngine.evaluate(oilySkin(), ["Myristyl Myristate", "Aqua", "Isopropyl Myristate"]);

    assert.equal(ordered.compatibilityScore, shuffled.compatibilityScore);
    assert.equal(ordered.totalWarnings, shuffled.totalWarnings);
    assert.equal(ordered.riskLevel, shuffled.riskLevel);
  });

  test("Motor girdi listesini değiştirmemeli", () => {
    const formula = ["Aqua", "Isopropyl Myristate"];
    const snapshot = [...formula];

    SkinCompatibilityEngine.evaluate(oilySkin(), formula);

    assert.deepEqual(formula, snapshot, "girdi dizisi yan etkiyle bozulmamalı");
  });

  test("Kuru ciltte aynı formül farklı ama tutarlı sonuç vermeli", () => {
    const formula = COMEDOGENIC_INGREDIENTS;

    const oily = SkinCompatibilityEngine.evaluate(oilySkin(), formula);
    const dry = SkinCompatibilityEngine.evaluate(drySkin(), formula);

    assert.ok(oily.compatibilityScore < dry.compatibilityScore, "yağlı cilt için puan daha düşük olmalı");
    assert.equal(dry.compatibilityScore, 100);
  });
});
