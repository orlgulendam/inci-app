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
}

module.exports = User;
