// src/app.js - Express Uygulaması Yapılandırması
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const correlationIdMiddleware = require("./core/middlewares/correlationId");
const requestLogger = require("./core/middlewares/requestLogger");
const errorHandler = require("./core/middlewares/errorHandler");
const { NotFoundError } = require("./core/errors/AppError");
const { getDb } = require("./core/database/mongo");

const app = express();

// 1) Temel Güvenlik ve Ayrıştırma Middleware'leri
app.use(helmet({
  contentSecurityPolicy: false // Statik HTML arayüzün yerel çalışabilmesi için
}));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 2) İzlenebilirlik ve Loglama
app.use(correlationIdMiddleware);
app.use(requestLogger);

// 3) Statik Dosyalar (PWA / Web UI)
app.use(express.static(path.join(__dirname, "../public")));

// 3.1) Swagger UI API Dökümantasyonu (/api/v1/docs)
const config = require("./core/config/env");
if (config.swagger.enabled) {
  const swaggerUi = require("swagger-ui-express");
  const swaggerSpec = require("./core/docs/swaggerSpec");
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "INCI Engine API Dökümantasyonu",
    swaggerOptions: {
      persistAuthorization: true
    }
  }));
}


// 4) Health Check Uç Noktaları
const healthHandler = async (req, res, next) => {
  try {
    let dbStatus = "disconnected";
    let productCount = 0;
    try {
      const db = getDb();
      dbStatus = "connected";
      productCount = await db.collection("products").estimatedDocumentCount();
    } catch (_) {
      dbStatus = "pending_or_failed";
    }

    res.json({
      success: true,
      data: {
        status: "UP",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          status: dbStatus,
          totalProducts: productCount
        },
        engine: "INCI Engine v2.0 (Modular Monolith)",
        regulations: "EC No 1223/2009 (Annex II-VI)"
      }
    });
  } catch (err) {
    next(err);
  }
};

app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

// 5) Modül Router'ları
const initializeAnalysisModule = require("./modules/analysis");
const initializeCatalogModule = require("./modules/catalog");
const initializePersonalizationModule = require("./modules/personalization");
const initializeCommunityModule = require("./modules/community");

const analysisModule = initializeAnalysisModule();
const catalogModule = initializeCatalogModule({
  analysisFacade: analysisModule.facade
});
const personalizationModule = initializePersonalizationModule({
  catalogFacade: catalogModule.facade
});
const communityModule = initializeCommunityModule({
  catalogFacade: catalogModule.facade,
  personalizationFacade: personalizationModule.facade,
  authMiddleware: personalizationModule.authMiddleware
});

app.locals.analysisFacade = analysisModule.facade;
app.locals.catalogFacade = catalogModule.facade;
app.locals.personalizationFacade = personalizationModule.facade;
app.locals.communityFacade = communityModule.facade;

app.use("/api/v1", analysisModule.router);
app.use("/api/v1", catalogModule.router);
app.use("/api/v1", personalizationModule.router);
app.use("/api/v1", communityModule.router);

// 6) Tanımsız Uç Nokta (404)
app.use((req, res, next) => {
  next(new NotFoundError(`İstenen uç nokta bulunamadı: ${req.method} ${req.originalUrl}`));
});

// 7) Merkezi Hata Yakalayıcı (En sonda yer almalı)
app.use(errorHandler);

module.exports = app;
