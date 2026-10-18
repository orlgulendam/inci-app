// src/modules/analysis/presentation/controllers/AnalysisController.js - Presentation Katmanı
// Yalnızca HTTP isteklerini ve parametre doğrulamasını yönetir (SRP).
const { ValidationError, NotFoundError } = require("../../../../core/errors/AppError");

class AnalysisController {
  constructor(analysisService, ingredientRepository) {
    this.analysisService = analysisService;
    this.ingredientRepository = ingredientRepository;
  }

  analyzeText = async (req, res, next) => {
    try {
      const text = req.body.ingredientsText || req.body.text || "";
      if (!text || typeof text !== "string" || text.trim().length < 3) {
        throw new ValidationError("Lütfen analiz edilecek içerik metnini en az 3 karakter olarak girin.", [
          { field: "ingredientsText", message: "ingredientsText zorunludur." }
        ]);
      }

      const result = await this.analysisService.analyze(text);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  searchIngredients = async (req, res, next) => {
    try {
      const query = (req.query.q || "").trim();
      const limit = parseInt(req.query.limit, 10) || 20;

      if (!query || query.length < 2) {
        throw new ValidationError("Arama terimi en az 2 karakter olmalıdır.", [
          { field: "q", message: "q parametresi en az 2 karakter olmalıdır." }
        ]);
      }

      const results = await this.ingredientRepository.search(query, limit);
      return res.status(200).json({
        success: true,
        data: results,
        meta: {
          total: results.length,
          query
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getIngredientByInci = async (req, res, next) => {
    try {
      const inciName = req.params.inci;
      const ingredient = await this.ingredientRepository.findByInciName(inciName);

      if (!ingredient) {
        throw new NotFoundError(`'${inciName}' adına sahip kimyasal sözlükte bulunamadı.`);
      }

      return res.status(200).json({
        success: true,
        data: ingredient
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AnalysisController;
