// tests/personalization/routineVanityGamification.test.js - Cilt Rutini, Dijital Dolap ve İstiridye Sandığı Testleri
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const User = require("../../src/modules/personalization/domain/entities/User");

describe("Cilt Rutini (Sabah & Akşam) Domain Mantığı", () => {
  test("Sabah rutini tamamlandığında +3 İnci vermeli, tekrarında puan vermemeli", () => {
    const user = new User({
      id: "user-routine-1",
      email: "routine@inci.app",
      points: 10
    });

    const fixedNow = new Date("2026-10-22T08:00:00Z");
    const res1 = user.completeRoutine("morning", fixedNow);

    assert.equal(res1.status, "COMPLETED");
    assert.equal(res1.pointsAwarded, 3);
    assert.equal(user.points, 13);
    assert.equal(res1.bothCompletedBonus, false);

    // Aynı gün sabah tekrarı
    const res2 = user.completeRoutine("morning", fixedNow);
    assert.equal(res2.status, "ALREADY_COMPLETED");
    assert.equal(res2.pointsAwarded, 0);
    assert.equal(user.points, 13);
  });

  test("Aynı gün hem Sabah hem Akşam rutini tamamlandığında +2 gün sonu bonusu vermeli", () => {
    const user = new User({
      id: "user-routine-2",
      email: "routine2@inci.app",
      points: 0
    });

    const fixedNow = new Date("2026-10-22T08:00:00Z");
    user.completeRoutine("morning", fixedNow); // +3
    assert.equal(user.points, 3);

    const eveningNow = new Date("2026-10-22T21:00:00Z");
    const eveningRes = user.completeRoutine("evening", eveningNow); // +3 + 2 (bonus) = +5

    assert.equal(eveningRes.status, "COMPLETED");
    assert.equal(eveningRes.pointsAwarded, 5);
    assert.equal(eveningRes.bothCompletedBonus, true);
    assert.equal(user.points, 8); // Toplam 8 İnci!
  });
});

describe("Dijital Cilt Bakım Dolabı ve PAO / SKT Takibi", () => {
  test("Ürün eklendiğinde PAO kalan gün ve tazelik durumunu doğru hesaplamalı", () => {
    const user = new User({
      id: "user-vanity-1",
      email: "vanity@inci.app"
    });

    const now = new Date("2026-10-22T10:00:00Z");

    // 1. Taze ürün (1 ay önce açılmış, 12 ay PAO)
    const freshDate = new Date("2026-09-22T10:00:00Z");
    user.addVanityItem({
      id: "item-1",
      name: "Hyaluronik Asit Serumu",
      brand: "The Ordinary",
      openedAt: freshDate,
      paoMonths: 12
    });

    // 2. Süresi dolmuş ürün (13 ay önce açılmış, 6 ay PAO)
    const expiredDate = new Date("2025-09-22T10:00:00Z");
    user.addVanityItem({
      id: "item-2",
      name: "Eski Güneş Kremi",
      brand: "La Roche-Posay",
      openedAt: expiredDate,
      paoMonths: 6
    });

    const items = user.getVanityItemsWithStatus(now);
    assert.equal(items.length, 2);

    const fresh = items.find((i) => i.id === "item-1");
    assert.equal(fresh.status, "FRESH");
    assert.ok(fresh.daysRemaining > 300);

    const expired = items.find((i) => i.id === "item-2");
    assert.equal(expired.status, "EXPIRED");
    assert.ok(expired.daysRemaining <= 0);

    // Çanta güvenlik skoru
    const safety = user.calculateVanitySafetyScore();
    assert.equal(safety.totalItems, 2);
    assert.equal(safety.expiredCount, 1);
    assert.ok(safety.score < 100);
  });
});

describe("7 Günlük İnci İstiridyesi Sandığı (Mystery Chest)", () => {
  test("Seri 7'den azsa sandık açılmamalı ve hata fırlatmalı", () => {
    const user = new User({
      id: "user-chest-1",
      email: "chest@inci.app",
      streakCount: 5
    });

    assert.throws(() => {
      user.claimOysterChest();
    }, /en az 7 günlük seri gerekir/);
  });

  test("Seri 7 gün olduğunda sürpriz 25-50 arası İnci ve rozet kazandırmalı", () => {
    const user = new User({
      id: "user-chest-2",
      email: "chest2@inci.app",
      streakCount: 7,
      points: 10
    });

    const loot = user.claimOysterChest();
    assert.equal(loot.milestone, 7);
    assert.ok(loot.pointsAwarded >= 25 && loot.pointsAwarded <= 50);
    assert.equal(user.points, 10 + loot.pointsAwarded);
    assert.equal(loot.earnedBadge, "Haftalık Cilt Disiplini 🦪");

    // Aynı kilometre taşını tekrar açamamalı
    assert.throws(() => {
      user.claimOysterChest();
    }, /zaten açtınız/);
  });
});
