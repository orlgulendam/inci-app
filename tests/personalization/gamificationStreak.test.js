// tests/personalization/gamificationStreak.test.js - İnci Serisi (Daily Streak) ve Puanlama Testleri
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");
const User = require("../../src/modules/personalization/domain/entities/User");
const SkinProfile = require("../../src/modules/personalization/domain/value-objects/SkinProfile");

function makeRequest(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        method: options.method || "GET",
        headers: options.headers || {}
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(body);
          } catch (_) {
            parsed = body;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        });
      }
    );
    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

describe("İnci Serisi (Streak) & Oyunlaştırma Kuralları", () => {
  let server;

  beforeEach((t, done) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => done());
  });

  afterEach((t, done) => {
    if (server) {
      server.close(() => done());
    } else {
      done();
    }
  });

  test("İnci Serisi: İlk gün taramasında seri 1 olmalı ve +5 puan kazanılmalı", () => {
    const user = new User({ email: "test@inci.app", points: 0 });
    const day1 = new Date("2026-10-01T10:00:00Z");

    const res1 = user.recordDailyScan(day1);
    assert.equal(res1.streakCount, 1);
    assert.equal(res1.pointsAwarded, 5);
    assert.equal(user.points, 5);
    assert.equal(res1.status, "STARTED");

    // Aynı gün içinde ikinci taramada streak artmamalı ve mükerrer puan verilmemeli
    const sameDay = new Date("2026-10-01T15:30:00Z");
    const resSame = user.recordDailyScan(sameDay);
    assert.equal(resSame.streakCount, 1);
    assert.equal(resSame.pointsAwarded, 0);
    assert.equal(user.points, 5);
    assert.equal(resSame.status, "ALREADY_SCANNED_TODAY");
  });

  test("İnci Serisi: Ertesi gün tarandığında seri 2 olmalı ve tekrar +5 puan kazanılmalı", () => {
    const user = new User({ email: "test@inci.app", points: 5, streakCount: 1, lastScanDate: "2026-10-01" });
    const day2 = new Date("2026-10-02T09:00:00Z");

    const res2 = user.recordDailyScan(day2);
    assert.equal(res2.streakCount, 2);
    assert.equal(res2.pointsAwarded, 5);
    assert.equal(user.points, 10);
    assert.equal(res2.status, "CONTINUED");
  });

  test("İnci Serisi: 1 gün atlandığında seri bozulmalı (RESET) ve 1'e dönmeli", () => {
    const user = new User({ email: "test@inci.app", points: 10, streakCount: 5, lastScanDate: "2026-10-01" });
    // 2 gün sonra (3 Ekim) tarama yapılıyor, 2 Ekim atlandı
    const dayMissed = new Date("2026-10-03T11:00:00Z");

    const resBreak = user.recordDailyScan(dayMissed);
    assert.equal(resBreak.streakCount, 1);
    assert.equal(resBreak.pointsAwarded, 5);
    assert.equal(user.points, 15);
    assert.equal(resBreak.status, "RESET");
  });

  test("Profil %100 Bonusu: Cilt profili %100 olunca tek seferlik +30 puan verilmeli", () => {
    const completeProfile = new SkinProfile({
      skinType: "combination",
      conditions: ["akne"],
      allergicIngredients: ["Fragrance"],
      targetedBenefits: ["nemlendirme"],
      frequentlyUsedProducts: ["Nemlendirici"],
      routineMedications: ["Retinol"]
    });

    assert.equal(completeProfile.completionPercentage, 100);

    const user = new User({
      email: "test@inci.app",
      points: 10,
      skinProfile: completeProfile
    });

    const claimed = user.claimProfileCompletionBonus();
    assert.equal(claimed, true);
    assert.equal(user.points, 40); // 10 + 30 = 40
    assert.equal(user.profileCompletedBonusClaimed, true);

    // İkinci kez talep edildiğinde tekrar verilmemeli
    const claimedAgain = user.claimProfileCompletionBonus();
    assert.equal(claimedAgain, false);
    assert.equal(user.points, 40);
  });

  test("POST /api/v1/community/report-issue: Hatalı içerik bildirimi 20 puan vaadiyle kaydedilmeli", async () => {
    const res = await makeRequest(server, "/api/v1/community/report-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        barcode: "8690123456789",
        productName: "CeraVe Nemlendirici Krem",
        issueDescription: "İçerik listesinde Seramid eksik yazılmış.",
        suggestedCorrection: "Ceramide NP, Ceramide AP eklenmeli"
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.rewardPoints, 20);
    assert.equal(res.body.data.status, "RECEIVED");
  });
});
