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
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.getFullName(),
      isEmailVerified: user.isEmailVerified,
      points: user.points,
      role: user.role,
      skinProfile: user.skinProfile
    };
  }

  async updateSkinProfile(userId, profileData) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Kullanıcı bulunamadı.");
    }

    if (profileData.firstName !== undefined) {
      user.firstName = profileData.firstName ? String(profileData.firstName).trim() : null;
    }
    if (profileData.lastName !== undefined) {
      user.lastName = profileData.lastName ? String(profileData.lastName).trim() : null;
    }

    // Yeni Değer Nesnesi oluştur
    user.skinProfile = new SkinProfile({
      skinType: profileData.skinType !== undefined ? profileData.skinType : user.skinProfile.skinType,
      conditions: profileData.conditions !== undefined ? profileData.conditions : user.skinProfile.conditions,
      allergicIngredients: profileData.allergicIngredients !== undefined ? profileData.allergicIngredients : user.skinProfile.allergicIngredients,
      frequentlyUsedProducts: profileData.frequentlyUsedProducts !== undefined ? profileData.frequentlyUsedProducts : user.skinProfile.frequentlyUsedProducts,
      routineMedications: profileData.routineMedications !== undefined ? profileData.routineMedications : user.skinProfile.routineMedications,
      dermatologistNotes: profileData.dermatologistNotes !== undefined ? profileData.dermatologistNotes : user.skinProfile.dermatologistNotes,
      targetedBenefits: profileData.targetedBenefits !== undefined ? profileData.targetedBenefits : user.skinProfile.targetedBenefits
    });

    await this.userRepository.save(user);

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.getFullName(),
      isEmailVerified: user.isEmailVerified,
      points: user.points,
      role: user.role,
      skinProfile: user.skinProfile
    };
  }
}

module.exports = ProfileService;

