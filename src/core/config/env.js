// src/core/config/env.js - Ortam Değişkenleri ve Konfigürasyon Yöneticisi
require("dotenv").config();

const INSECURE_JWT_SECRET = "default_dev_secret_replace_in_prod";

const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT, 10) || 3000,
  mongo: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGO_DB_NAME || "obf"
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || INSECURE_JWT_SECRET,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
  },
  ai: {
    // Birincil görsel (Vision) sağlayıcısı.
    // qwen/qwen3.8-27b Groq üzerinde görsel girdi + json_object destekliyor (23.11.2026 canlı doğrulandı)
    // ve emekliye ayrılan llama-3.2-11b-vision-preview modelinin yerini alır.
    // Gemini ikincil yedek olarak korunur; anahtarı geçerlidir ve Vision çağrısı 200 döner.
    provider: process.env.AI_VISION_PROVIDER || "groq", // "groq" | "gemini"
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    groqApiKey: process.env.GROQ_API_KEY || "",
    groqModel: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",
    groqChatModel: process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b",
    fallbackEnabled: process.env.AI_FALLBACK_ENABLED !== "false"
  },
  swagger: {
    enabled: process.env.ENABLE_SWAGGER !== "false"
  }
};

// Uretimde guvensiz varsayilan anahtarla calismak, saldirganin istedigi
// kullanici/rol icin gecerli JWT uretebilmesi demektir. Bu durumda uygulama
// sessizce calismak yerine acilista durur.
if (config.isProduction && config.security.jwtSecret === INSECURE_JWT_SECRET) {
  throw new Error(
    "Guvenlik: Uretim ortaminda JWT_SECRET tanimlanmalidir. " +
    "Varsayilan gelistirme anahtari ile uretimde calisilamaz."
  );
}

module.exports = config;
module.exports.INSECURE_JWT_SECRET = INSECURE_JWT_SECRET;

