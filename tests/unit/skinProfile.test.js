// tests/unit/skinProfile.test.js - Cilt Profili Değer Nesnesi Birim Testleri
// Gerekçe: Arayüz Türkçe cilt tipi ve grup alerjen çipleri gönderiyor; domain İngilizce
// sabitler bekliyordu. Eşleme olmadan her kullanıcı sessizce "combination" oluyor ve
// alerjen uyarıları hiç tetiklenmiyordu.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const SkinProfile = require("../../src/modules/personalization/domain/value-objects/SkinProfile");

describe("SkinProfile: Türkçe/İngilizce hizalama ve alerjen grupları", () => {
  test("Türkçe cilt tipleri İngilizce domain sabitlerine çevrilmeli", () => {
    assert.equal(new SkinProfile({ skinType: "kuru" }).skinType, "dry");
    assert.equal(new SkinProfile({ skinType: "yagli" }).skinType, "oily");
    assert.equal(new SkinProfile({ skinType: "yağlı" }).skinType, "oily");
    assert.equal(new SkinProfile({ skinType: "karma" }).skinType, "combination");
    assert.equal(new SkinProfile({ skinType: "hassas" }).skinType, "sensitive");
    assert.equal(new SkinProfile({ skinType: "normal" }).skinType, "normal");
  });

  test("İngilizce cilt tipleri bozulmadan korunmalı", () => {
    for (const t of ["dry", "oily", "combination", "normal", "sensitive"]) {
      assert.equal(new SkinProfile({ skinType: t }).skinType, t);
    }
  });

  test("Tanınmayan cilt tipi güvenli varsayılana düşmeli", () => {
    assert.equal(new SkinProfile({ skinType: "zzz" }).skinType, "combination");
    assert.equal(new SkinProfile({}).skinType, "combination");
  });

  test("dermatologistNotes düz metin gönderildiğinde korunmalı", () => {
    const profile = new SkinProfile({ dermatologistNotes: "Retinol kullanmamam söylendi" });
    assert.equal(profile.dermatologistNotes.length, 1);
    assert.equal(profile.dermatologistNotes[0].note, "Retinol kullanmamam söylendi");
    assert.ok(profile.dermatologistNotes[0].date);
  });

  test("dermatologistNotes dizi formatını da desteklemeli", () => {
    const profile = new SkinProfile({
      dermatologistNotes: [{ note: "Bariyer zayıf", date: "2026-10-15T00:00:00.000Z" }]
    });
    assert.equal(profile.dermatologistNotes.length, 1);
    assert.equal(profile.dermatologistNotes[0].date, "2026-10-15T00:00:00.000Z");
  });

  test("Boş not sessizce atılmalı, hata vermemeli", () => {
    assert.deepEqual(new SkinProfile({ dermatologistNotes: "   " }).dermatologistNotes, []);
    assert.deepEqual(new SkinProfile({ dermatologistNotes: null }).dermatologistNotes, []);
  });

  test("'Parabens' çipi gerçek paraben INCI adlarıyla eşleşmeli", () => {
    const profile = new SkinProfile({ allergicIngredients: ["Parabens"] });
    assert.equal(profile.isAllergicTo("METHYLPARABEN"), true);
    assert.equal(profile.isAllergicTo("PROPYLPARABEN"), true);
    assert.equal(profile.isAllergicTo("GLYCERIN"), false);
  });

  test("'Sulfates (SLS/SLES)' çipi sülfat yüzey aktifleriyle eşleşmeli", () => {
    const profile = new SkinProfile({ allergicIngredients: ["Sulfates (SLS/SLES)"] });
    assert.equal(profile.isAllergicTo("SODIUM LAURETH SULFATE"), true);
    assert.equal(profile.isAllergicTo("SODIUM LAURYL SULFATE"), true);
    // Yanlış pozitif olmamalı: magnezyum sülfat bir yüzey aktif değildir
    assert.equal(profile.isAllergicTo("MAGNESIUM SULFATE"), false);
  });

  test("'Fragrance (Parfüm)' çipi koku bileşenleriyle eşleşmeli", () => {
    const profile = new SkinProfile({ allergicIngredients: ["Fragrance (Parfüm)"] });
    assert.equal(profile.isAllergicTo("PARFUM"), true);
    assert.equal(profile.isAllergicTo("FRAGRANCE"), true);
    assert.equal(profile.isAllergicTo("AQUA"), false);
  });

  test("Doğrudan INCI adı alerjeni hâlâ çalışmalı", () => {
    const profile = new SkinProfile({ allergicIngredients: ["LINALOOL"] });
    assert.equal(profile.isAllergicTo("LINALOOL"), true);
    assert.equal(profile.isAllergicTo("LIMONENE"), false);
  });

  test("Cilt durumları normalize edilip sorgulanabilmeli", () => {
    const profile = new SkinProfile({ conditions: ["Rosacea", "FUNGAL_ACNE", "Egzama"] });
    assert.equal(profile.hasCondition("rosacea"), true);
    assert.equal(profile.hasCondition("fungal_acne"), true);
    assert.equal(profile.hasCondition("eczema"), false);
  });
});
