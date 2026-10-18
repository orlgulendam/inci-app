// src/modules/personalization/application/services/AuthService.js - Kimlik Doğrulama Servisi (SRP & Security)
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../../../../core/config/env");
const { ValidationError, UnauthorizedError, ConflictError, NotFoundError } = require("../../../../core/errors/AppError");
const User = require("../../domain/entities/User");

class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async register({ email, password, firstName = null, lastName = null, role = "user" }) {
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

    // E-posta doğrulama belirteci üretimi (32 bayt hex)
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = new User({
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      isEmailVerified: false,
      emailVerificationToken: verificationToken
    });

    const id = await this.userRepository.save(user);
    return {
      id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      verificationToken // Dev/Test ortamında kolay doğrulama için döner
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
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      },
      config.security.jwtSecret,
      { expiresIn: "24h" }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        points: user.points
      }
    };
  }

  async verifyEmail(token) {
    if (!token || typeof token !== "string") {
      throw new ValidationError("Doğrulama belirteci zorunludur.");
    }

    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new ValidationError("Geçersiz veya süresi dolmuş e-posta doğrulama linki.");
    }

    user.verifyEmail(token);
    await this.userRepository.save(user);

    return {
      message: "E-posta adresiniz başarıyla doğrulandı.",
      email: user.email,
      isEmailVerified: true
    };
  }

  async resendVerification(email) {
    if (!email || !email.includes("@")) {
      throw new ValidationError("Geçerli bir e-posta adresi gereklidir.");
    }

    const user = await this.userRepository.findByEmail(email);
    // Güvenlik: Kullanıcı bulunamazsa veya zaten doğrulanmışsa bilgi sızdırmadan genel yanıt döner
    if (!user || user.isEmailVerified) {
      return {
        message: "Eğer hesabınız mevcut ve henüz doğrulanmamışsa, yeni doğrulama linki oluşturuldu."
      };
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    user.setVerificationToken(newToken);
    await this.userRepository.save(user);

    return {
      message: "Yeni e-posta doğrulama linki gönderildi.",
      verificationToken: newToken
    };
  }

  async forgotPassword(email) {
    if (!email || !email.includes("@")) {
      throw new ValidationError("Geçerli bir e-posta adresi gereklidir.");
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Bilgi ifşasını engellemek için kullanıcı var gibi yanıt döner
      return {
        message: "Şifre sıfırlama talebiniz alındı. Kayıtlı e-posta adresinize talimatlar iletildi."
      };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.setPasswordResetToken(resetToken, 3600000); // 1 saat
    await this.userRepository.save(user);

    return {
      message: "Şifre sıfırlama talebiniz alındı. Kayıtlı e-posta adresinize talimatlar iletildi.",
      resetToken // Dev/Test ortamı için
    };
  }

  async resetPassword({ token, newPassword }) {
    if (!token || typeof token !== "string") {
      throw new ValidationError("Şifre sıfırlama belirteci gereklidir.");
    }
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError("Yeni parola en az 6 karakter olmalıdır.");
    }

    const user = await this.userRepository.findByResetToken(token);
    if (!user || !user.isResetTokenValid(token)) {
      throw new ValidationError("Geçersiz veya süresi dolmuş şifre sıfırlama belirteci.");
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.clearPasswordReset();
    await this.userRepository.save(user);

    return {
      message: "Parolanız başarıyla güncellendi. Yeni parolanızla giriş yapabilirsiniz."
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

