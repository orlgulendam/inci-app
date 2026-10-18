// src/modules/personalization/presentation/controllers/ProfileController.js
class ProfileController {
  constructor(profileService, compatibilityService) {
    this.profileService = profileService;
    this.compatibilityService = compatibilityService;
  }

  getProfile = async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const profile = await this.profileService.getSkinProfile(userId);
      return res.status(200).json({
        success: true,
        data: profile
      });
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const profileData = req.body;
      const updated = await this.profileService.updateSkinProfile(userId, profileData);
      return res.status(200).json({
        success: true,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  };

  checkCompatibility = async (req, res, next) => {
    try {
      const userId = req.user ? req.user.sub : null;
      const { barcode, rawIngredientsText, inlineProfile } = req.body;

      const result = await this.compatibilityService.checkProductCompatibility({
        userId,
        barcode,
        rawIngredientsText,
        inlineProfile
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  deleteAccount = async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const result = await this.profileService.deleteAccount(userId);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProfileController;

