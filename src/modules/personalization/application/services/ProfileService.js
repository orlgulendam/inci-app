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
      streakCount: user.streakCount,
      lastScanDate: user.lastScanDate,
      profileCompletedBonusClaimed: user.profileCompletedBonusClaimed,
      badges: user.badges || [],
      openedChests: user.openedChests || [],
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

    // Profil ilk defa %100 doldurulduğunda +30 puan ödülü ver
    const bonusAwarded = user.claimProfileCompletionBonus();

    await this.userRepository.save(user);

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.getFullName(),
      isEmailVerified: user.isEmailVerified,
      points: user.points,
      streakCount: user.streakCount,
      lastScanDate: user.lastScanDate,
      bonusAwarded,
      role: user.role,
      skinProfile: user.skinProfile
    };
  }

  /**
   * Kullanıcının günlük taramasını kaydeder ve İnci Serisini (Streak) günceller
   * @param {string} userId
   * @param {Date} [now=new Date()]
   */
  async recordDailyScan(userId, now = new Date()) {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;

    const streakResult = user.recordDailyScan(now);
    await this.userRepository.save(user);

    return {
      userId: user.id,
      points: user.points,
      streakCount: user.streakCount,
      lastScanDate: user.lastScanDate,
      ...streakResult
    };
  }

  async deleteAccount(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Kullanıcı bulunamadı.");
    }

    await this.userRepository.deleteById(userId);
    return {
      message: "Hesabınız ve tüm ilişkili verileriniz başarıyla kalıcı olarak silindi."
    };
  }

  // --- CİLT RUTİNİ SERVİSİ ---

  async getRoutine(userId, now = new Date()) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

    return {
      routine: user.routine || { morning: [], evening: [] },
      todayStatus: user.getTodayRoutineStatus(now)
    };
  }

  async updateRoutine(userId, { morning, evening }) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

    user.updateRoutine({ morning, evening });
    await this.userRepository.save(user);

    return {
      routine: user.routine,
      todayStatus: user.getTodayRoutineStatus()
    };
  }

  async completeRoutine(userId, routineType, now = new Date()) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

    const result = user.completeRoutine(routineType, now);
    await this.userRepository.save(user);

    return {
      ...result,
      points: user.points
    };
  }

  // --- DİJİTAL DOLAP SERVİSİ ---

  async getVanity(userId, now = new Date()) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

    const items = user.getVanityItemsWithStatus(now);
    const safetyScore = user.calculateVanitySafetyScore();

    return {
      items,
      safetyScore
    };
  }

  async addVanityItem(userId, itemData) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

    const newItem = user.addVanityItem(itemData);
    await this.userRepository.save(user);

    return newItem;
  }

  async removeVanityItem(userId, itemId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

    const removed = user.removeVanityItem(itemId);
    if (!removed) {
      throw new NotFoundError("Belirtilen dolap öğesi bulunamadı.");
    }

    await this.userRepository.save(user);
    return { success: true, message: "Ürün dolaptan kaldırıldı." };
  }

  // --- 7 GÜNLÜK İSTİRİDYE SANDIĞI (MYSTERY CHEST) ---

  async claimOysterChest(userId, now = new Date()) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

    const result = user.claimOysterChest(now);
    await this.userRepository.save(user);

    return result;
  }
}

module.exports = ProfileService;


