// src/modules/personalization/infrastructure/repositories/IUserRepository.js - Kullanıcı Deposu Sözleşmesi (DIP)
class IUserRepository {
  async findById(id) {
    throw new Error("Method findById() must be implemented.");
  }

  async findByEmail(email) {
    throw new Error("Method findByEmail() must be implemented.");
  }

  async save(user) {
    throw new Error("Method save() must be implemented.");
  }

  async updatePoints(userId, delta, session = null) {
    throw new Error("Method updatePoints() must be implemented.");
  }
}

module.exports = IUserRepository;
