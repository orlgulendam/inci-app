// src/modules/catalog/application/services/BrandService.js - Marka İş Mantığı Servisi (SRP)
const { NotFoundError, ValidationError } = require("../../../../core/errors/AppError");
const Brand = require("../../domain/entities/Brand");

class BrandService {
  constructor(brandRepository) {
    this.brandRepository = brandRepository;
  }

  async getAllBrands({ limit = 50, page = 1 } = {}) {
    return this.brandRepository.findAll({ limit, page });
  }

  async getByName(name) {
    if (!name || typeof name !== "string") {
      throw new ValidationError("Marka adı geçerli bir metin olmalıdır.");
    }
    const brand = await this.brandRepository.findByName(name);
    if (!brand) {
      throw new NotFoundError(`'${name}' adına sahip marka bulunamadı.`);
    }
    return brand;
  }

  async createBrand(data) {
    if (!data.name) {
      throw new ValidationError("Marka adı zorunludur.");
    }
    const brand = new Brand(data);
    const id = await this.brandRepository.save(brand);
    return { id, brand };
  }
}

module.exports = BrandService;
