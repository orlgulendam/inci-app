// src/modules/catalog/infrastructure/repositories/IProductRepository.js - Ürün Deposu Arayüzü (DIP)
class IProductRepository {
  async findByBarcode(barcode) {
    throw new Error("Method findByBarcode() must be implemented.");
  }

  async search({ query, category, limit = 20, page = 1 }) {
    throw new Error("Method search() must be implemented.");
  }

  async save(product) {
    throw new Error("Method save() must be implemented.");
  }
}

module.exports = IProductRepository;
