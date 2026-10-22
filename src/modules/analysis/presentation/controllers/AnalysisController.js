// src/modules/analysis/presentation/controllers/AnalysisController.js - Presentation Katmanı
// Yalnızca HTTP isteklerini ve parametre doğrulamasını yönetir (SRP).
const { ValidationError, NotFoundError } = require("../../../../core/errors/AppError");
const { formatSuccessResponse } = require("../../../../core/utils/apiResponse");
const GeminiVisionOcrService = require("../../infrastructure/ocr/GeminiVisionOcrService");

class AnalysisController {
  constructor(analysisService, ingredientRepository, ocrService = null) {
    this.analysisService = analysisService;
    this.ingredientRepository = ingredientRepository;
    this.ocrService = ocrService || new GeminiVisionOcrService();
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

  extractOcrText = async (req, res, next) => {
    try {
      const image = req.body.image || req.body.base64Data || req.body.photo;
      if (!image || typeof image !== "string" || image.trim().length < 20) {
        throw new ValidationError("Analiz edilecek ambalaj görseli (base64 formatında) zorunludur.", [
          { field: "image", message: "Geçerli bir base64 görsel verisi gönderilmelidir." }
        ]);
      }

      const mimeType = req.body.mimeType || "image/jpeg";
      const ocrResult = await this.ocrService.extractIngredientsFromImage({
        base64Data: image,
        mimeType
      });

      let analysisResult = null;
      if (req.body.autoAnalyze && ocrResult.ingredientsText && ocrResult.ingredientsText.length >= 3) {
        analysisResult = await this.analysisService.analyze(ocrResult.ingredientsText);
      }

      return res.status(200).json({
        success: true,
        data: {
          ...ocrResult,
          analysis: analysisResult
        }
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
      const response = formatSuccessResponse(results, {
        meta: {
          total: results.length,
          query
        },
        fields: req.query.fields
      });

      return res.status(200).json(response);
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

      const response = formatSuccessResponse(ingredient, {
        fields: req.query.fields
      });

      return res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  detectConflicts = async (req, res, next) => {
    try {
      const { ingredientsA, ingredientsB, textA, textB } = req.body;
      const inputA = ingredientsA || textA || "";
      const inputB = ingredientsB || textB || null;

      if (!inputA || (typeof inputA === "string" && inputA.trim().length < 2) && (!Array.isArray(inputA) || inputA.length === 0)) {
        throw new ValidationError("Çakışma analizi için en az bir içerik listesi (ingredientsA / textA) gereklidir.", [
          { field: "ingredientsA", message: "ingredientsA boş olamaz." }
        ]);
      }

      const result = this.analysisService.detectConflicts(inputA, inputB);
      return res.status(200).json(formatSuccessResponse(result));
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AnalysisController;
