// src/modules/analysis/infrastructure/repositories/IIngredientRepository.js - Repository Arayüzü (DIP)
// Gerekçe: İş mantığının somut veritabanına değil soyut sözleşmeye bağımlı olması için Repository deseni.

class IIngredientRepository {
  async findByInciName(inciName) {
    throw new Error("Method findByInciName() must be implemented.");
  }

  async search(query, limit = 20) {
    throw new Error("Method search() must be implemented.");
  }

  async bulkFindByInciNames(names) {
    throw new Error("Method bulkFindByInciNames() must be implemented.");
  }
}

module.exports = IIngredientRepository;
