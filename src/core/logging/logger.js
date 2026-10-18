// src/core/logging/logger.js - Yapılandırılmış JSON Loglama
const config = require("../config/env");

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel = config.isProduction ? LogLevel.INFO : LogLevel.DEBUG;

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  // KVKK / GDPR Koruması: Parola, token ve hassas sağlık verilerini loglardan maskele
  if (logEntry.password) logEntry.password = "***MASKED***";
  if (logEntry.token) logEntry.token = "***MASKED***";
  if (logEntry.skin_profile) logEntry.skin_profile = "***HEALTH_DATA_MASKED***";

  return JSON.stringify(logEntry);
}

const logger = {
  debug(message, meta) {
    if (currentLevel <= LogLevel.DEBUG) {
      console.log(formatLog("DEBUG", message, meta));
    }
  },
  info(message, meta) {
    if (currentLevel <= LogLevel.INFO) {
      console.log(formatLog("INFO", message, meta));
    }
  },
  warn(message, meta) {
    if (currentLevel <= LogLevel.WARN) {
      console.warn(formatLog("WARN", message, meta));
    }
  },
  error(message, meta) {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(formatLog("ERROR", message, meta));
    }
  }
};

module.exports = logger;
