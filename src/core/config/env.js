// src/core/config/env.js - Ortam Değişkenleri ve Konfigürasyon Yöneticisi
require("dotenv").config();

const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT, 10) || 3000,
  mongo: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGO_DB_NAME || "obf"
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || "default_dev_secret_replace_in_prod",
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
  }
};

module.exports = config;
