// src/modules/personalization/presentation/controllers/AdminController.js - Yönetici Uç Noktaları Denetleyicisi
class AdminController {
  constructor(adminService) {
    this.adminService = adminService;
  }

  getUsers = async (req, res, next) => {
    try {
      const { page, limit, search } = req.query;
      const result = await this.adminService.listUsers({ page, limit, search });
      return res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta
      });
    } catch (err) {
      next(err);
    }
  };

  getScanLogs = async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const result = await this.adminService.listScanLogs({ page, limit });
      return res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AdminController;
