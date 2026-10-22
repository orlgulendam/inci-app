// src/modules/personalization/domain/entities/User.js - Kullanıcı Domain Varlığı
const SkinProfile = require("../value-objects/SkinProfile");

class User {
  constructor({
    id = null,
    email,
    passwordHash,
    firstName = null,
    lastName = null,
    role = "user", // "user" | "moderator" | "admin"
    isEmailVerified = false,
    emailVerificationToken = null,
    passwordResetToken = null,
    passwordResetExpires = null,
    points = 0,
    streakCount = 0,
    lastScanDate = null,
    profileCompletedBonusClaimed = false,
    skinProfile = null,
    routine = null,
    routineHistory = null,
    vanity = null,
    badges = null,
    openedChests = null,
    createdAt = new Date()
  }) {
    if (!email || !email.includes("@")) {
      throw new Error("Geçerli bir e-posta adresi gereklidir.");
    }

    this.id = id;
    this.email = email.toLowerCase().trim();
    this.passwordHash = passwordHash;
    this.firstName = firstName ? firstName.trim() : null;
    this.lastName = lastName ? lastName.trim() : null;
    this.role = role;
    this.isEmailVerified = !!isEmailVerified;
    this.emailVerificationToken = emailVerificationToken;
    this.passwordResetToken = passwordResetToken;
    this.passwordResetExpires = passwordResetExpires ? new Date(passwordResetExpires) : null;
    this.points = Math.max(0, parseInt(points, 10) || 0);
    this.streakCount = Math.max(0, parseInt(streakCount, 10) || 0);
    this.lastScanDate = lastScanDate;
    this.profileCompletedBonusClaimed = !!profileCompletedBonusClaimed;
    this.skinProfile = skinProfile instanceof SkinProfile ? skinProfile : new SkinProfile(skinProfile || {});
    this.routine = routine || { morning: [], evening: [] };
    this.routineHistory = Array.isArray(routineHistory) ? routineHistory : [];
    this.vanity = Array.isArray(vanity) ? vanity : [];
    this.badges = Array.isArray(badges) ? badges : [];
    this.openedChests = Array.isArray(openedChests) ? openedChests : [];
    this.createdAt = createdAt;
  }

  getFullName() {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.email.split("@")[0];
  }

  isAdmin() {
    return this.role === "admin";
  }

  isModerator() {
    return this.role === "moderator" || this.role === "admin";
  }

  addPoints(amount) {
    if (amount > 0) {
      this.points += amount;
    }
  }

  /**
   * Günlük ürün taraması kaydeder ve İnci Serisini (Daily Streak) yönetir
   * @param {Date} [now=new Date()]
   * @returns {{ streakCount: number, pointsAwarded: number, status: string }}
   */
  recordDailyScan(now = new Date()) {
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (!this.lastScanDate) {
      this.streakCount = 1;
      this.lastScanDate = todayStr;
      this.addPoints(5);
      return { streakCount: 1, pointsAwarded: 5, status: "STARTED" };
    }

    const lastDateStr = typeof this.lastScanDate === "string"
      ? this.lastScanDate.slice(0, 10)
      : new Date(this.lastScanDate).toISOString().slice(0, 10);

    if (lastDateStr === todayStr) {
      // Bugün zaten tarama yapılmış, seri devam ediyor ama aynı gün 2. defa streak puanı verilmez
      return { streakCount: this.streakCount, pointsAwarded: 0, status: "ALREADY_SCANNED_TODAY" };
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.round((new Date(todayStr) - new Date(lastDateStr)) / msPerDay);

    if (diffDays === 1) {
      // Dün taranmış: Seri bozulmadı, 1 gün uzadı!
      this.streakCount += 1;
      this.lastScanDate = todayStr;
      this.addPoints(5);
      return { streakCount: this.streakCount, pointsAwarded: 5, status: "CONTINUED" };
    } else {
      // 1 günden fazla ara verilmiş: Seri bozuldu, 1'den yeniden başlar!
      this.streakCount = 1;
      this.lastScanDate = todayStr;
      this.addPoints(5);
      return { streakCount: 1, pointsAwarded: 5, status: "RESET" };
    }
  }

  /**
   * Cilt profili %100 doldurulduğunda tek seferlik +30 puan bonusunu verir
   * @returns {boolean}
   */
  claimProfileCompletionBonus() {
    if (!this.profileCompletedBonusClaimed && this.skinProfile && this.skinProfile.completionPercentage === 100) {
      this.profileCompletedBonusClaimed = true;
      this.addPoints(30);
      return true;
    }
    return false;
  }

  verifyEmail(token) {
    if (!this.emailVerificationToken || this.emailVerificationToken !== token) {
      throw new Error("Geçersiz veya süresi dolmuş e-posta doğrulama kodu.");
    }
    this.isEmailVerified = true;
    this.emailVerificationToken = null;
  }

  setVerificationToken(token) {
    this.emailVerificationToken = token;
    this.isEmailVerified = false;
  }

  setPasswordResetToken(token, expiresInMs = 3600000) { // 1 saat geçerli
    this.passwordResetToken = token;
    this.passwordResetExpires = new Date(Date.now() + expiresInMs);
  }

  isResetTokenValid(token) {
    if (!this.passwordResetToken || this.passwordResetToken !== token) return false;
    if (!this.passwordResetExpires || this.passwordResetExpires < new Date()) return false;
    return true;
  }

  clearPasswordReset() {
    this.passwordResetToken = null;
    this.passwordResetExpires = null;
  }

  // --- CİLT RUTİNİ METOTLARI (Sabah & Akşam) ---

  updateRoutine({ morning, evening }) {
    if (morning && Array.isArray(morning)) {
      this.routine.morning = morning;
    }
    if (evening && Array.isArray(evening)) {
      this.routine.evening = evening;
    }
  }

  getTodayRoutineStatus(now = new Date()) {
    const todayStr = now.toISOString().slice(0, 10);
    const log = this.routineHistory.find((r) => r.date === todayStr);
    return {
      date: todayStr,
      morningCompleted: log ? !!log.morningCompleted : false,
      eveningCompleted: log ? !!log.eveningCompleted : false,
      morningCompletedAt: log ? log.morningCompletedAt : null,
      eveningCompletedAt: log ? log.eveningCompletedAt : null
    };
  }

  completeRoutine(routineType, now = new Date()) {
    const validTypes = ["morning", "evening"];
    if (!validTypes.includes(routineType)) {
      throw new Error("Geçersiz rutin türü. 'morning' (Sabah) veya 'evening' (Akşam) olmalıdır.");
    }

    const todayStr = now.toISOString().slice(0, 10);
    let todayLog = this.routineHistory.find((r) => r.date === todayStr);

    if (!todayLog) {
      todayLog = {
        date: todayStr,
        morningCompleted: false,
        eveningCompleted: false,
        morningCompletedAt: null,
        eveningCompletedAt: null
      };
      this.routineHistory.push(todayLog);
    }

    const alreadyDoneKey = `${routineType}Completed`;
    if (todayLog[alreadyDoneKey]) {
      return {
        status: "ALREADY_COMPLETED",
        routineType,
        pointsAwarded: 0,
        bothCompletedBonus: false,
        todayStatus: this.getTodayRoutineStatus(now)
      };
    }

    todayLog[alreadyDoneKey] = true;
    todayLog[`${routineType}CompletedAt`] = now.toISOString();

    let pointsAwarded = 3; // Rutin başına +3 İnci
    let bothCompletedBonus = false;

    // Eğer her iki rutin (Sabah ve Akşam) tamamlandıysa +2 İnci gün sonu bonusu
    if (todayLog.morningCompleted && todayLog.eveningCompleted) {
      pointsAwarded += 2;
      bothCompletedBonus = true;
    }

    this.addPoints(pointsAwarded);

    return {
      status: "COMPLETED",
      routineType,
      pointsAwarded,
      bothCompletedBonus,
      todayStatus: this.getTodayRoutineStatus(now)
    };
  }

  // --- DİJİTAL DOLAP & PAO (SKT) METOTLARI ---

  addVanityItem({ id = null, productId = null, name, brand = null, openedAt = new Date(), paoMonths = 12, notes = null }) {
    if (!name || name.trim().length === 0) {
      throw new Error("Ürün adı boş olamaz.");
    }

    const safePao = Math.max(1, parseInt(paoMonths, 10) || 12);
    const openDate = openedAt ? new Date(openedAt) : new Date();

    const newItem = {
      id: id || `vanity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      productId: productId || null,
      name: name.trim(),
      brand: brand ? brand.trim() : null,
      openedAt: openDate.toISOString(),
      paoMonths: safePao,
      notes: notes ? notes.trim() : null
    };

    this.vanity.push(newItem);
    return newItem;
  }

  removeVanityItem(itemId) {
    const initialLen = this.vanity.length;
    this.vanity = this.vanity.filter((item) => item.id !== String(itemId));
    return this.vanity.length < initialLen;
  }

  getVanityItemsWithStatus(now = new Date()) {
    const today = now.getTime();
    const msPerDay = 1000 * 60 * 60 * 24;

    return this.vanity.map((item) => {
      const openedDate = new Date(item.openedAt);
      const expiryDate = new Date(openedDate);
      expiryDate.setMonth(expiryDate.getMonth() + item.paoMonths);

      const totalLifetimeDays = Math.max(1, Math.round((expiryDate.getTime() - openedDate.getTime()) / msPerDay));
      const daysRemaining = Math.round((expiryDate.getTime() - today) / msPerDay);
      const percentRemaining = Math.max(0, Math.min(100, Math.round((daysRemaining / totalLifetimeDays) * 100)));

      let status = "FRESH"; // FRESH | EXPIRING_SOON | EXPIRED
      let statusTextTr = "Taze ve Güvenli";

      if (daysRemaining <= 0) {
        status = "EXPIRED";
        statusTextTr = "Süresi Doldu! (Bakteri Riski)";
      } else if (daysRemaining <= 30) {
        status = "EXPIRING_SOON";
        statusTextTr = "Son 30 Gün! Yakında Tüketiniz";
      }

      return {
        ...item,
        expiryDate: expiryDate.toISOString(),
        daysRemaining,
        percentRemaining,
        status,
        statusTextTr
      };
    });
  }

  // --- 7 GÜNLÜK İSTİRİDYE SANDIĞI (MYSTERY CHEST) ---

  claimOysterChest(now = new Date()) {
    if (this.streakCount < 7) {
      throw new Error(`İstiridye sandığını açmak için en az 7 günlük seri gerekir. Mevcut seriniz: ${this.streakCount}`);
    }

    const currentMilestone = Math.floor(this.streakCount / 7) * 7;
    if (this.openedChests.includes(currentMilestone)) {
      throw new Error(`${currentMilestone}. Gün İstiridye Sandığını zaten açtınız! Bir sonraki sandık için serinizi koruyun.`);
    }

    // 25 ile 50 arası rastgele İnci ödülü
    const randomBonus = Math.floor(Math.random() * 26) + 25; // 25..50
    this.addPoints(randomBonus);
    this.openedChests.push(currentMilestone);

    // Seri kilometre taşı rozeti
    let earnedBadge = null;
    if (currentMilestone === 7 && !this.badges.includes("Haftalık Cilt Disiplini 🦪")) {
      earnedBadge = "Haftalık Cilt Disiplini 🦪";
    } else if (currentMilestone === 14 && !this.badges.includes("Derin Deniz Kaşifi 🌊")) {
      earnedBadge = "Derin Deniz Kaşifi 🌊";
    } else if (currentMilestone >= 21 && !this.badges.includes("Işıltılı İnci Kraliçesi 👑")) {
      earnedBadge = "Işıltılı İnci Kraliçesi 👑";
    }

    if (earnedBadge) {
      this.badges.push(earnedBadge);
    }

    return {
      milestone: currentMilestone,
      pointsAwarded: randomBonus,
      totalPoints: this.points,
      earnedBadge,
      allBadges: this.badges
    };
  }

  // --- CİLT BAKIM ÇANTASI TEMİZLİK SKORU (Share Card İçin) ---

  calculateVanitySafetyScore() {
    const items = this.getVanityItemsWithStatus();
    if (items.length === 0) {
      return { score: 100, label: "Tertemiz Başlangıç", expiredCount: 0, totalItems: 0 };
    }

    const expired = items.filter((i) => i.status === "EXPIRED").length;
    const expiringSoon = items.filter((i) => i.status === "EXPIRING_SOON").length;

    let score = 100;
    score -= expired * 35; // Her süresi geçmiş ürün 35 puan kırar
    score -= expiringSoon * 10;
    score = Math.max(10, Math.min(100, score));

    let label = "Kusursuz & Taze Rutin 🌟";
    if (score < 50) label = "Acil Temizlik Gerekiyor ⚠️";
    else if (score < 80) label = "Yenilenme Zamanı 🧴";

    return {
      score,
      label,
      totalItems: items.length,
      freshCount: items.length - expired - expiringSoon,
      expiringSoonCount: expiringSoon,
      expiredCount: expired
    };
  }
}

module.exports = User;
