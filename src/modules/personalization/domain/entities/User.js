// src/modules/personalization/domain/entities/User.js - Kullanıcı Domain Varlığı
const SkinProfile = require("../value-objects/SkinProfile");

class User {
  constructor({
    id = null,
    email,
    passwordHash,
    role = "user", // "user" | "moderator" | "admin"
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
    this.role = role;
    this.points = Math.max(0, parseInt(points, 10) || 0);
    this.skinProfile = skinProfile instanceof SkinProfile ? skinProfile : new SkinProfile(skinProfile || {});
    this.createdAt = createdAt;
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
}

module.exports = User;
