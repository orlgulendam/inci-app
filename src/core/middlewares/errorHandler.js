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

  // Gövde ayrıştırma hataları (express.json).
  // Bunlar AppError değil, ama kullanıcı hatası: 500 "beklenmeyen hata" demek
  // yanıltıcı. 10 MB sınırını aşan bir ambalaj fotoğrafı gönderen kullanıcıya
  // "Sunucuda beklenmeyen bir hata meydana geldi" gösteriliyordu.
  if (err && err.type === "entity.too.large") {
    logger.warn("Request body too large", { correlationId, url: req.originalUrl, limit: err.limit });
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Gönderdiğiniz görsel veya veri çok büyük. Lütfen daha düşük çözünürlüklü bir fotoğraf ile tekrar deneyin.",
        correlationId
      }
    });
  }

  if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError && "body" in err)) {
    logger.warn("Request body parse failed", { correlationId, url: req.originalUrl });
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "İstek gövdesi geçerli bir JSON değil.",
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
