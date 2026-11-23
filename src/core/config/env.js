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
  },
  ai: {
    provider: process.env.AI_VISION_PROVIDER || "gemini", // "gemini" | "groq"
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    groqApiKey: process.env.GROQ_API_KEY || "",
    // Groq tarafında vision modelleri sık sık kullanımdan kaldırılıyor; varsayılan vermiyoruz.
    // Groq Vision yedeğini açmak için GROQ_VISION_MODEL'e canlı bir model adı yazılmalıdır.
    groqModel: process.env.GROQ_VISION_MODEL || "",
    fallbackEnabled: process.env.AI_FALLBACK_ENABLED !== "false"
  },
  swagger: {
    enabled: process.env.ENABLE_SWAGGER !== "false"
  }
};

module.exports = config;

