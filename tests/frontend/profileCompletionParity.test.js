// tests/frontend/profileCompletionParity.test.js
// Gerileme testi: arayuz ve backend tamamlanma yuzdesi ayni sonucu vermeli.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SkinProfile = require("../../src/modules/personalization/domain/value-objects/SkinProfile");

const VIEW_PATH = path.join(
  __dirname, "..", "..", "public", "js", "views", "ProfileWizardView.js"
);

/**
 * Arayuzdeki calculateCompletion govdesini kaynak dosyadan cikarip calistirir.
 * Boylece iki hesap birbirinden ayrismaya basladigi anda test kirmizi olur.
 */
function arayuzYuzdesi(profileData) {
  const source = fs.readFileSync(VIEW_PATH, "utf-8");
  const match = source.match(/calculateCompletion\(\)\s*\{([\s\S]*?)\n {2}\}/);
  assert.ok(match, "calculateCompletion govdesi bulunamadi");

  // eslint-disable-next-line no-new-func
  const fn = new Function("profileData", match[1].replace(/this\.profileData/g, "profileData"));
  return fn(profileData);
}

const SENARYOLAR = [
  {
    ad: "bos profil",
    arayuz: {
      conditions: [], allergicIngredients: [], targetedBenefits: [],
      frequentlyUsedProducts: [], routineMedications: [], dermatologistNotes: ""
    },
    backend: {}
  },
  {
    ad: "yalnizca cilt durumu secili",
    arayuz: {
      conditions: ["eczema"], allergicIngredients: [], targetedBenefits: [],
      frequentlyUsedProducts: [], routineMedications: [], dermatologistNotes: ""
    },
    backend: { conditions: ["eczema"] }
  },
  {
    ad: "tam doldurulmus profil",
    arayuz: {
      conditions: ["eczema"], allergicIngredients: ["Parabens"], targetedBenefits: ["Nemlendirme"],
      frequentlyUsedProducts: ["CeraVe"], routineMedications: [], dermatologistNotes: "Bariyer zayif"
    },
    backend: {
      conditions: ["eczema"], allergicIngredients: ["Parabens"], targetedBenefits: ["Nemlendirme"],
      frequentlyUsedProducts: ["CeraVe"], dermatologistNotes: "Bariyer zayif"
    }
  }
];

for (const senaryo of SENARYOLAR) {
  test(`Tamamlanma yuzdesi arayuz ve backend'de ayni olmali: ${senaryo.ad}`, () => {
    const backend = new SkinProfile(senaryo.backend).completionPercentage;
    const arayuz = arayuzYuzdesi(senaryo.arayuz);

    assert.strictEqual(
      arayuz,
      backend,
      `Arayuz %${arayuz}, backend %${backend} diyor; iki hesap ayrisamaz ` +
      "(+30 Inci bonusu backend'in sayisina gore veriliyor)"
    );
  });
}

test("Bos profil icin gosterilen yuzde %20 olmali (eskiden %65 gorunuyordu)", () => {
  assert.strictEqual(arayuzYuzdesi(SENARYOLAR[0].arayuz), 20);
});
