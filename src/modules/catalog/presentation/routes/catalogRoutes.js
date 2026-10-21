// src/modules/catalog/presentation/routes/catalogRoutes.js - Catalog Uç Noktaları
const { Router } = require("express");
const httpCache = require("../../../../core/middlewares/httpCache");

function createCatalogRoutes(productController, brandController) {
  const router = Router();

  // GET /api/v1/products/search?q=nivea&brand=The%20Purest%20Solutions&sort=safetyScore:desc&fields=barcode,productName
  router.get("/products/search", productController.search);

  // GET /api/v1/products/:barcode (1 saat istemci/ara önbellekleme)
  router.get(
    "/products/:barcode",
    httpCache({ maxAge: 3600, staleWhileRevalidate: 86400, isPublic: true }),
    productController.getByBarcode
  );

  // POST /api/v1/products (Ürün ekleme/güncelleme)
  router.post("/products", productController.create);

  // GET /api/v1/brands (12 saat istemci/ara önbellekleme)
  router.get(
    "/brands",
    httpCache({ maxAge: 43200, staleWhileRevalidate: 86400, isPublic: true }),
    brandController.list
  );

  return router;
}

module.exports = createCatalogRoutes;
