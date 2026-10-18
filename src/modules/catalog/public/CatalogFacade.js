// src/modules/catalog/public/CatalogFacade.js - Cephe Deseni (Facade Pattern)
// Gerekçe: Catalog modülünün iç modellerini gizleyerek personalization ve community modüllerine temiz arayüz sunmak.

class CatalogFacade {
  constructor(productService) {
    this.productService = productService;
  }

  async getProductByBarcode(barcode) {
    return this.productService.getByBarcode(barcode);
  }

  async searchProducts(query, limit = 10) {
    return this.productService.search({ query, limit });
  }

  async createProductFromContribution(data) {
    return this.productService.createOrUpdate(data);
  }
}

module.exports = CatalogFacade;
