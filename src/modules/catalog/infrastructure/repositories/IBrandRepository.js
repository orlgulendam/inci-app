// src/modules/catalog/infrastructure/repositories/IBrandRepository.js - Marka Deposu Arayüzü (DIP)
class IBrandRepository {
  async findAll({ limit = 50, page = 1 } = {}) {
    throw new Error("Method findAll() must be implemented.");
  }

  async findByName(name) {
    throw new Error("Method findByName() must be implemented.");
  }

  async save(brand) {
    throw new Error("Method save() must be implemented.");
  }
}

module.exports = IBrandRepository;
