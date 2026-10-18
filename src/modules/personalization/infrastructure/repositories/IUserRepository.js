// src/modules/personalization/infrastructure/repositories/IUserRepository.js - Kullanıcı Deposu Sözleşmesi (DIP)
class IUserRepository {
  async findById(id) {
    throw new Error("Method findById() must be implemented.");
  }

  async findByEmail(email) {
    throw new Error("Method findByEmail() must be implemented.");
  }

  async findByVerificationToken(token) {
    throw new Error("Method findByVerificationToken() must be implemented.");
  }

  async findByResetToken(token) {
    throw new Error("Method findByResetToken() must be implemented.");
  }

  async findAllUsers({ page = 1, limit = 20, search = null } = {}) {
    throw new Error("Method findAllUsers() must be implemented.");
  }

  async save(user) {
    throw new Error("Method save() must be implemented.");
  }

  async updatePoints(userId, delta, session = null) {
    throw new Error("Method updatePoints() must be implemented.");
  }
}

module.exports = IUserRepository;
