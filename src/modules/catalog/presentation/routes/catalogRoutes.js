// src/modules/catalog/presentation/routes/catalogRoutes.js - Catalog Uç Noktaları
const { Router } = require("express");

function createCatalogRoutes(productController, brandController) {
  const router = Router();

  // GET /api/v1/products/search?q=nivea
  router.get("/products/search", productController.search);

  // GET /api/v1/products/:barcode
  router.get("/products/:barcode", productController.getByBarcode);

  // POST /api/v1/products (Ürün ekleme/güncelleme)
  router.post("/products", productController.create);

  // GET /api/v1/brands
  router.get("/brands", brandController.list);

  return router;
}

module.exports = createCatalogRoutes;
