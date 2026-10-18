// src/server.js - HTTP Sunucusu ve Yaşam Döngüsü Yöneticisi
const app = require("./app");
const config = require("./core/config/env");
const logger = require("./core/logging/logger");
const { connectToMongo, closeMongo } = require("./core/database/mongo");

let server = null;

async function bootstrap() {
  try {
    // 1) Veritabanı bağlantısını başlat
    await connectToMongo();

    // 2) HTTP Sunucusunu dinlemeye başla
    server = app.listen(config.port, () => {
      logger.info(`🚀 INCI Engine server is running on port ${config.port}`, {
        port: config.port,
        env: config.env,
        docs: `http://localhost:${config.port}/api/v1/health`
      });
    });

    // 3) Graceful Shutdown (Kibar Kapanma) sinyallerini dinle
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      if (server) {
        server.close(async () => {
          logger.info("HTTP server closed.");
          await closeMongo();
          logger.info("Process terminated gracefully.");
          process.exit(0);
        });
      } else {
        await closeMongo();
        process.exit(0);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error) {
    logger.error("Failed to start INCI Engine server", { error: error.message });
    process.exit(1);
  }
}

bootstrap();
