// src/modules/analysis/public/index.js - Modülün Dış Dünyaya Açık Kapısı
// Dış modüller (catalog, personalization vb.) YALNIZCA bu dosyadan import yapabilir.
const AnalysisFacade = require("./AnalysisFacade");

module.exports = {
  AnalysisFacade
};
