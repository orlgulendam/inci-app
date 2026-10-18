// src/modules/personalization/application/services/ProfileService.js - Cilt Profili Servisi (SRP)
const { NotFoundError, ValidationError } = require("../../../../core/errors/AppError");
const SkinProfile = require("../../domain/value-objects/SkinProfile");

class ProfileService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async getSkinProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Kullanıcı bulunamadı.");
    }
    return user.skinProfile;
  }

  async updateSkinProfile(userId, profileData) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Kullanıcı bulunamadı.");
    }

    // Yeni Değer Nesnesi oluştur
    user.skinProfile = new SkinProfile({
      skinType: profileData.skinType || user.skinProfile.skinType,
      conditions: profileData.conditions || user.skinProfile.conditions,
      allergicIngredients: profileData.allergicIngredients || user.skinProfile.allergicIngredients
    });

    await this.userRepository.save(user);
    return user.skinProfile;
  }
}

module.exports = ProfileService;
