// src/modules/personalization/application/services/AuthService.js - Kimlik Doğrulama Servisi (SRP & Security)
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../../../../core/config/env");
const { ValidationError, UnauthorizedError, ConflictError } = require("../../../../core/errors/AppError");
const User = require("../../domain/entities/User");

class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async register({ email, password, role = "user" }) {
    if (!email || !email.includes("@")) {
      throw new ValidationError("Geçerli bir e-posta adresi gereklidir.");
    }
    if (!password || password.length < 6) {
      throw new ValidationError("Parola en az 6 karakter olmalıdır.");
    }

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError("Bu e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut.");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      passwordHash,
      role
    });

    const id = await this.userRepository.save(user);
    return {
      id,
      email: user.email,
      role: user.role
    };
  }

  async login({ email, password }) {
    if (!email || !password) {
      throw new ValidationError("E-posta ve parola zorunludur.");
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError("Geçersiz e-posta veya parola.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Geçersiz e-posta veya parola.");
    }

    // JWT Üretimi (Hassas sağlık verisi token içine konulmaz - KVKK)
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.security.jwtSecret,
      { expiresIn: "24h" }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        points: user.points
      }
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.security.jwtSecret);
    } catch (_) {
      throw new UnauthorizedError("Geçersiz veya süresi dolmuş oturum anahtarı (JWT).");
    }
  }
}

module.exports = AuthService;
