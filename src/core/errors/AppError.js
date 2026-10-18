// src/core/errors/AppError.js - Temel Uygulama Hatası Sınıfı
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_SERVER_ERROR", details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Beklenen, kontrollü iş mantığı hatası
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Kaynak bulunamadı.", errorCode = "NOT_FOUND") {
    super(message, 404, errorCode);
  }
}

class ValidationError extends AppError {
  constructor(message = "Geçersiz veri girdisi.", details = null, errorCode = "VALIDATION_ERROR") {
    super(message, 400, errorCode, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Yetkilendirme başarısız.", errorCode = "UNAUTHORIZED") {
    super(message, 401, errorCode);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Bu işlem için erişim yetkiniz yok.", errorCode = "FORBIDDEN") {
    super(message, 403, errorCode);
  }
}

class ConflictError extends AppError {
  constructor(message = "Kaynak çakışması meydana geldi.", errorCode = "CONFLICT") {
    super(message, 409, errorCode);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
};
