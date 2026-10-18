// src/modules/community/presentation/controllers/ContributionController.js - Katkı İstek Kontrolcüsü (SRP)
const { ValidationError, UnauthorizedError } = require("../../../../core/errors/AppError");

class ContributionController {
  constructor(contributionService) {
    this.contributionService = contributionService;
  }

  submit = async (req, res, next) => {
    try {
      if (!req.user || !req.user.sub) {
        throw new UnauthorizedError("Katkı göndermek için oturum açmalısınız.");
      }

      const { barcode, productName, brandName, rawIngredientsText, imageUrl } = req.body;
      const result = await this.contributionService.submitContribution({
        userId: req.user.sub,
        barcode,
        productName,
        brandName,
        rawIngredientsText,
        imageUrl
      });

      return res.status(201).json({
        success: true,
        data: {
          id: result.id,
          barcode: result.contribution.barcode,
          productName: result.contribution.productName,
          status: result.contribution.status.value
        }
      });
    } catch (err) {
      next(err);
    }
  };

  listPending = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;

      const result = await this.contributionService.listPending({ page, limit });
      return res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta
      });
    } catch (err) {
      next(err);
    }
  };

  approve = async (req, res, next) => {
    try {
      const contributionId = req.params.id;
      const { reviewerNote } = req.body;

      const result = await this.contributionService.approveContribution({
        contributionId,
        reviewerNote
      });

      return res.status(200).json({
        success: true,
        message: "Katkı onaylandı, ürün resmi kataloğa eklendi ve kullanıcıya 50 puan tanımlandı.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  reject = async (req, res, next) => {
    try {
      const contributionId = req.params.id;
      const { reason } = req.body;

      if (!reason) {
        throw new ValidationError("Reddetme gerekçesi belirtilmelidir.");
      }

      const result = await this.contributionService.rejectContribution({
        contributionId,
        reason
      });

      return res.status(200).json({
        success: true,
        message: "Katkı reddedildi.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ContributionController;
