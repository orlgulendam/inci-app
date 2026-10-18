// src/core/middlewares/errorHandler.js - Merkezi Hata Yakalama Middleware
const logger = require("../logging/logger");
const { AppError } = require("../errors/AppError");

function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || "unknown";

  // Bilinen, operasyonel iş mantığı hatası mı?
  if (err instanceof AppError) {
    logger.warn(`Operational Error: ${err.message}`, {
      correlationId,
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      details: err.details
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details || undefined,
        correlationId
      }
    });
  }

  // Beklenmeyen sistem / sunucu hatası (500)
  logger.error(`Unhandled Exception: ${err.message}`, {
    correlationId,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Güvenlik: İç sistem detaylarını ve stack trace'i istemciye sızdırma
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Sunucuda beklenmeyen bir hata meydana geldi.",
      correlationId
    }
  });
}

module.exports = errorHandler;
