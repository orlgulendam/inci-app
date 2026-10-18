// src/modules/catalog/presentation/controllers/BrandController.js - Marka İstek Kontrolcüsü (SRP)
class BrandController {
  constructor(brandService) {
    this.brandService = brandService;
  }

  list = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const result = await this.brandService.getAllBrands({ limit, page });

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

module.exports = BrandController;
