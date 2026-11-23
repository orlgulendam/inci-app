// src/modules/catalog/index.js - Catalog Modülü Giriş Noktası (Composition Root)
const MongoProductRepository = require("./infrastructure/repositories/MongoProductRepository");
const MongoBrandRepository = require("./infrastructure/repositories/MongoBrandRepository");
const ProductService = require("./application/services/ProductService");
const BrandService = require("./application/services/BrandService");
const ProductController = require("./presentation/controllers/ProductController");
const BrandController = require("./presentation/controllers/BrandController");
const createCatalogRoutes = require("./presentation/routes/catalogRoutes");
const CatalogFacade = require("./public/CatalogFacade");
const OpenBeautyFactsAdapter = require("./infrastructure/adapters/OpenBeautyFactsAdapter");

function initializeCatalogModule({
  analysisFacade = null,
  productRepository = null,
  brandRepository = null,
  externalCatalogAdapter = undefined
} = {}) {
  const prodRepo = productRepository || new MongoProductRepository();
  const brandRepo = brandRepository || new MongoBrandRepository();

  // Harici katalog adaptörü testlerde null geçilerek kapatılabilir.
  const externalAdapter =
    externalCatalogAdapter === undefined ? new OpenBeautyFactsAdapter() : externalCatalogAdapter;

  const productService = new ProductService(prodRepo, brandRepo, analysisFacade, externalAdapter);
  const brandService = new BrandService(brandRepo);

  const productController = new ProductController(productService);
  const brandController = new BrandController(brandService);

  const router = createCatalogRoutes(productController, brandController);
  const facade = new CatalogFacade(productService);

  return {
    productRepository: prodRepo,
    brandRepository: brandRepo,
    productService,
    brandService,
    productController,
    brandController,
    router,
    facade
  };
}

module.exports = initializeCatalogModule;
