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
