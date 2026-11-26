// src/modules/personalization/application/services/AdminService.js - Yönetici İşlemleri Servisi (SRP)

/**
 * Yönetici listesine çıkacak alanların BEYAZ LİSTESİ.
 *
 * Önceden kullanıcı nesnesi olduğu gibi dönüyordu; yanıt
 * emailVerificationToken / passwordResetToken / passwordResetExpires
 * belirteçlerini ve KVKK m.6 kapsamındaki eksiksiz skinProfile
 * (cilt durumları, alerjenler, ilaçlar, dermatolog notları) verisini
 * içeriyordu. Yönetim ekranının bunların hiçbirine ihtiyacı yok.
 */
function toAdminUserView(user) {
  if (!user) return null;

  const skinProfile = user.skinProfile || null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    role: user.role,
    isEmailVerified: Boolean(user.isEmailVerified),
    points: user.points || 0,
    streakCount: user.streakCount || 0,
    lastScanDate: user.lastScanDate || null,
    createdAt: user.createdAt || null,
    // Sağlık verisinin kendisi değil, yalnızca doluluk göstergesi
    skinProfileCompletionPercentage: skinProfile ? (skinProfile.completionPercentage || 0) : 0
  };
}

class AdminService {
  constructor(userRepository, scanLogRepository) {
    this.userRepository = userRepository;
    this.scanLogRepository = scanLogRepository;
  }

  async listUsers({ page = 1, limit = 20, search = null } = {}) {
    const result = await this.userRepository.findAllUsers({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search
    });

    return {
      ...result,
      items: (result.items || []).map(toAdminUserView)
    };
  }

  async listScanLogs({ page = 1, limit = 20 } = {}) {
    return this.scanLogRepository.findRecentLogs({ page: Number(page) || 1, limit: Number(limit) || 20 });
  }
}

module.exports = AdminService;
module.exports.toAdminUserView = toAdminUserView;
