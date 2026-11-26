// tests/analysis/conflictRuleCoverage.test.js - Kapsamsız Kalan Çakışma Kuralları
// Odak: IngredientConflictEngine'in altı kuralından dördü hiçbir testte kapsanmıyordu.
// Mevcut conflictEngine.test.js yalnızca RETINOID_AND_DIRECT_ACIDS ve
// PURE_VITAMIN_C_AND_DIRECT_ACIDS kurallarını doğruluyor. Bu dosya kalan dört kuralı,
// girdi normalizasyonunu (dizi/metin), karşılaştırma modunun simetrisini ve genel risk
// seviyesinin öncelik sırasını ele alır.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const IngredientConflictEngine = require("../../src/modules/analysis/domain/services/IngredientConflictEngine");

const engine = new IngredientConflictEngine();
const ruleIds = (result) => result.conflicts.map((c) => c.ruleId);
const findRule = (result, id) => result.conflicts.find((c) => c.ruleId === id);

describe("Çakışma Kuralları: Retinoid + Benzoil Peroksit", () => {
  test("Retinoid ve benzoil peroksit HIGH risk olarak tespit edilmeli", () => {
    const result = engine.detectConflicts(["Aqua", "Retinol"], ["Aqua", "Benzoyl Peroxide"]);

    assert.equal(result.hasConflicts, true);
    assert.equal(result.overallRisk, "HIGH");
    assert.ok(ruleIds(result).includes("RETINOID_AND_BENZOYL_PEROXIDE"));
  });

  test("Kural etkisizleşme gerekçesini ve dermatolog tavsiyesini taşımalı", () => {
    const result = engine.detectConflicts(["Tretinoin"], ["Benzoyl Peroxide"]);
    const conflict = findRule(result, "RETINOID_AND_BENZOYL_PEROXIDE");

    assert.equal(conflict.severity, "HIGH");
    assert.equal(conflict.triggerA, "Tretinoin");
    assert.equal(conflict.triggerB, "Benzoyl Peroxide");
    assert.match(conflict.description, /oksitleyici/i);
    assert.ok(conflict.dermatologistAdvice.length > 0);
  });

  test("Benzoil peroksit tek başına çakışma üretmemeli", () => {
    const result = engine.detectConflicts(["Aqua", "Benzoyl Peroxide", "Glycerin"]);

    assert.equal(result.hasConflicts, false);
    assert.equal(result.overallRisk, "SAFE");
  });
});

describe("Çakışma Kuralları: Retinoid + Saf C Vitamini", () => {
  test("Retinol ve askorbik asit MEDIUM risk olarak tespit edilmeli", () => {
    const result = engine.detectConflicts(["Retinol"], ["Ascorbic Acid"]);

    assert.equal(result.overallRisk, "MEDIUM");
    assert.ok(ruleIds(result).includes("RETINOID_AND_PURE_VITAMIN_C"));
  });

  test("Kural pH uyuşmazlığını açıklamalı", () => {
    const conflict = findRule(engine.detectConflicts(["Retinal"], ["L-Ascorbic Acid"]), "RETINOID_AND_PURE_VITAMIN_C");

    assert.equal(conflict.severity, "MEDIUM");
    assert.match(conflict.description, /pH/);
    assert.match(conflict.dermatologistAdvice, /Sabah|Akşam/);
  });

  test("Hidroksipinakolon retinoat da retinoid sayılmalı", () => {
    const result = engine.detectConflicts(["Hydroxypinacolone Retinoate"], ["Ascorbic Acid"]);

    assert.ok(ruleIds(result).includes("RETINOID_AND_PURE_VITAMIN_C"));
  });
});

describe("Çakışma Kuralları: Bakır Peptitleri", () => {
  test("Bakır tripeptit ve glikolik asit MEDIUM risk üretmeli", () => {
    const result = engine.detectConflicts(["Copper Tripeptide-1"], ["Glycolic Acid"]);

    assert.equal(result.overallRisk, "MEDIUM");
    assert.ok(ruleIds(result).includes("COPPER_PEPTIDES_AND_DIRECT_ACIDS_OR_VIT_C"));
  });

  test("Bakır peptidinin uzun INCI yazımı da tanınmalı", () => {
    const result = engine.detectConflicts(["Bis(Tripeptide-1) Copper Acetate"], ["Ascorbic Acid"]);

    const conflict = findRule(result, "COPPER_PEPTIDES_AND_DIRECT_ACIDS_OR_VIT_C");
    assert.ok(conflict, "uzun yazım da kuralı tetiklemeli");
    assert.equal(conflict.triggerA, "Bis(Tripeptide-1) Copper Acetate");
  });

  test("Bakır peptidi nötr bileşenlerle çakışmamalı", () => {
    const result = engine.detectConflicts(["Copper Tripeptide-1"], ["Hyaluronic Acid", "Niacinamide", "Panthenol"]);

    assert.equal(result.hasConflicts, false);
    assert.equal(result.overallRisk, "SAFE");
  });

  test("Kural şelat bağı bozulmasını açıklamalı", () => {
    const conflict = findRule(
      engine.detectConflicts(["Copper Tripeptide-1"], ["Salicylic Acid"]),
      "COPPER_PEPTIDES_AND_DIRECT_ACIDS_OR_VIT_C"
    );

    assert.match(conflict.description, /şelat/i);
  });
});

describe("Çakışma Kuralları: Niasinamid + Saf Asit", () => {
  test("Niasinamid ve askorbik asit LOW risk üretmeli", () => {
    const result = engine.detectConflicts(["Niacinamide"], ["Ascorbic Acid"]);

    assert.equal(result.overallRisk, "LOW");
    assert.ok(ruleIds(result).includes("HIGH_NIACINAMIDE_AND_PURE_ACID"));
  });

  test("Niasinamid ve glikolik asit de aynı kuralı tetiklemeli", () => {
    const result = engine.detectConflicts(["Niacinamide"], ["Glycolic Acid"]);

    assert.ok(ruleIds(result).includes("HIGH_NIACINAMIDE_AND_PURE_ACID"));
    assert.equal(findRule(result, "HIGH_NIACINAMIDE_AND_PURE_ACID").severity, "LOW");
  });

  test("Niasinamid salisilik asitle bu kuralı tetiklememeli", () => {
    // Kural yalnızca askorbik ve glikolik asidi kapsar.
    const result = engine.detectConflicts(["Niacinamide"], ["Salicylic Acid"]);

    assert.equal(ruleIds(result).includes("HIGH_NIACINAMIDE_AND_PURE_ACID"), false);
  });

  test("Kural niasin oluşumu ve bekleme tavsiyesini içermeli", () => {
    const conflict = findRule(
      engine.detectConflicts(["Niacinamide"], ["Ascorbic Acid"]),
      "HIGH_NIACINAMIDE_AND_PURE_ACID"
    );

    assert.match(conflict.description, /niasin/i);
    assert.match(conflict.dermatologistAdvice, /15-20 dakika/);
  });
});

describe("Çakışma Motoru: Girdi Normalizasyonu", () => {
  test("Serbest metin girdisi dizi gibi ayrıştırılmalı", () => {
    const result = engine.detectConflicts("Aqua, Retinol", "Aqua, Glycolic Acid");

    assert.equal(result.overallRisk, "HIGH");
    assert.equal(findRule(result, "RETINOID_AND_DIRECT_ACIDS").triggerA, "Retinol");
  });

  test("Noktalı virgül ve satır sonu ayraçları da desteklenmeli", () => {
    assert.equal(engine.detectConflicts("Aqua; Retinol; Salicylic Acid").overallRisk, "HIGH");
    assert.equal(engine.detectConflicts("Retinol\nGlycolic Acid").overallRisk, "HIGH");
    assert.equal(engine.detectConflicts("Retinol • Glycolic Acid").overallRisk, "HIGH");
  });

  test("Metin ve dizi girdisi aynı sonucu vermeli", () => {
    const fromText = engine.detectConflicts("Retinol, Glycolic Acid");
    const fromArray = engine.detectConflicts(["Retinol", "Glycolic Acid"]);

    assert.deepEqual(fromText, fromArray);
  });

  test("Geçersiz ve boş girdilerde SAFE dönmeli, çökmemeli", () => {
    for (const input of [[], null, undefined, 42, {}, ""]) {
      const result = engine.detectConflicts(input);

      assert.equal(result.hasConflicts, false, `${JSON.stringify(input)} için çakışma beklenmez`);
      assert.equal(result.overallRisk, "SAFE");
      assert.deepEqual(result.conflicts, []);
    }
  });

  test("Dizi içindeki null ve boş değerler atlanıp geçerliler değerlendirilmeli", () => {
    const result = engine.detectConflicts([null, "Retinol", "", "Glycolic Acid", undefined]);

    assert.equal(result.overallRisk, "HIGH");
  });

  test("Tek bileşen her iki grupla eşleşse de kendisiyle çakışmamalı", () => {
    // "Ascorbic Acid" hem saf C vitamini hem asit kalıbına uyar; aynı jeton çakışma sayılmaz.
    const result = engine.detectConflicts(["Ascorbic Acid"]);

    assert.equal(result.hasConflicts, false);
    assert.equal(result.overallRisk, "SAFE");
  });
});

describe("Çakışma Motoru: Karşılaştırma Modu Simetrisi", () => {
  test("Grupların hangi üründe olduğu sonucu değiştirmemeli", () => {
    const forward = engine.detectConflicts(["Retinol"], ["Glycolic Acid"]);
    const reversed = engine.detectConflicts(["Glycolic Acid"], ["Retinol"]);

    assert.equal(forward.overallRisk, reversed.overallRisk);
    assert.deepEqual(ruleIds(forward), ruleIds(reversed));
    assert.equal(reversed.conflicts[0].triggerA, "Retinol", "tetikleyiciler kural grubuna göre adlandırılmalı");
    assert.equal(reversed.conflicts[0].triggerB, "Glycolic Acid");
  });

  test("Aynı grup her iki üründe varsa çakışma üretilmemeli", () => {
    const result = engine.detectConflicts(["Retinol"], ["Retinol"]);

    assert.equal(result.hasConflicts, false);
  });

  test("Karşılaştırma modunda bir kural en çok bir kez raporlanmalı", () => {
    const result = engine.detectConflicts(["Retinol", "Glycolic Acid"], ["Retinol", "Glycolic Acid"]);
    const retinoidAcid = result.conflicts.filter((c) => c.ruleId === "RETINOID_AND_DIRECT_ACIDS");

    assert.ok(retinoidAcid.length <= 1, `kural tekrarlanmamalı, gelen: ${retinoidAcid.length}`);
  });
});

describe("Çakışma Motoru: Genel Risk Önceliği", () => {
  test("HIGH çakışma varsa genel risk HIGH olmalı", () => {
    const result = engine.detectConflicts(["Retinol", "Niacinamide"], ["Glycolic Acid"]);

    assert.ok(result.conflictCount >= 2, "hem HIGH hem LOW kural tetiklenmeli");
    assert.equal(result.overallRisk, "HIGH", "en yüksek önem derecesi genel riski belirlemeli");
  });

  test("Yalnızca MEDIUM çakışmalarda genel risk MEDIUM olmalı", () => {
    const result = engine.detectConflicts(["Copper Tripeptide-1"], ["Lactic Acid"]);

    assert.equal(result.overallRisk, "MEDIUM");
  });

  test("Yalnızca LOW çakışmada genel risk LOW olmalı", () => {
    const result = engine.detectConflicts(["Niacinamide"], ["Glycolic Acid"]);

    assert.equal(result.conflictCount, 1);
    assert.equal(result.overallRisk, "LOW");
  });

  test("conflictCount raporlanan çakışma sayısıyla tutarlı olmalı", () => {
    const result = engine.detectConflicts(["Retinol", "Niacinamide"], ["Glycolic Acid", "Ascorbic Acid"]);

    assert.equal(result.conflictCount, result.conflicts.length);
    assert.equal(result.hasConflicts, result.conflicts.length > 0);
  });

  test("Altı kuralın tamamı aynı motorda tanımlı olmalı", () => {
    const defined = engine.conflictRules.map((r) => r.id);

    assert.deepEqual(defined, [
      "RETINOID_AND_DIRECT_ACIDS",
      "RETINOID_AND_BENZOYL_PEROXIDE",
      "PURE_VITAMIN_C_AND_DIRECT_ACIDS",
      "RETINOID_AND_PURE_VITAMIN_C",
      "COPPER_PEPTIDES_AND_DIRECT_ACIDS_OR_VIT_C",
      "HIGH_NIACINAMIDE_AND_PURE_ACID"
    ]);
    assert.ok(engine.conflictRules.every((r) => ["HIGH", "MEDIUM", "LOW"].includes(r.severity)));
    assert.ok(engine.conflictRules.every((r) => r.title && r.description && r.dermatologistAdvice));
  });
});
