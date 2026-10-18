// src/core/middlewares/requestLogger.js - İstek ve Süre Loglayıcı
const logger = require("../logging/logger");

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const meta = {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket.remoteAddress
    };

    if (res.statusCode >= 500) {
      logger.error("HTTP Request Failed", meta);
    } else if (res.statusCode >= 400) {
      logger.warn("HTTP Client Error", meta);
    } else {
      logger.info("HTTP Request Completed", meta);
    }
  });

  next();
}

module.exports = requestLogger;
