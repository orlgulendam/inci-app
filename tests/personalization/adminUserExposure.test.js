// tests/personalization/adminUserExposure.test.js
// Gerileme testi: yonetici kullanici listesi belirtecleri ve saglik verisini sizdirmamali.
const test = require("node:test");
const assert = require("node:assert");

const AdminService = require("../../src/modules/personalization/application/services/AdminService");

const SIZDIRILMAMASI_GEREKEN_ALANLAR = [
  "passwordHash",
  "emailVerificationToken",
  "passwordResetToken",
  "passwordResetExpires",
  "skinProfile",
  "routine",
  "routineHistory",
  "vanity"
];

test("listUsers belirtecleri ve cilt (saglik) verisini dondurmemeli", async () => {
  const userRepositoryStub = {
    async findAllUsers() {
      return {
        items: [{
          id: "u1",
          email: "kullanici@example.com",
          firstName: "Deniz",
          lastName: "Kullanici",
          role: "user",
          isEmailVerified: true,
          points: 30,
          streakCount: 1,
          passwordHash: "$2a$10$gizli",
          emailVerificationToken: "dogrulama-belirteci",
          passwordResetToken: "sifirlama-belirteci",
          passwordResetExpires: new Date(),
          skinProfile: {
            skinType: "dry",
            allergicIngredients: ["PARABENS"],
            dermatologistNotes: [{ note: "Bariyer zayif" }],
            completionPercentage: 100
          },
          routine: { morning: [], evening: [] },
          routineHistory: [],
          vanity: []
        }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 }
      };
    }
  };

  const service = new AdminService(userRepositoryStub, { async findRecentLogs() { return { items: [], meta: {} }; } });
  const result = await service.listUsers({});
  const user = result.items[0];

  for (const alan of SIZDIRILMAMASI_GEREKEN_ALANLAR) {
    assert.ok(!(alan in user), `Yonetici yanitinda '${alan}' alani bulunmamali`);
  }

  assert.strictEqual(user.email, "kullanici@example.com", "Yonetim icin gereken alanlar korunmali");
  assert.strictEqual(user.skinProfileCompletionPercentage, 100, "Saglik verisi yerine yalnizca doluluk yuzdesi donmeli");
  assert.strictEqual(result.meta.total, 1, "Sayfalama bilgisi korunmali");
});
