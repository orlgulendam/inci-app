// src/modules/catalog/presentation/controllers/ProductController.js - Ürün İstek Kontrolcüsü (SRP)
const { ValidationError } = require("../../../../core/errors/AppError");
const { formatSuccessResponse } = require("../../../../core/utils/apiResponse");

class ProductController {
  constructor(productService) {
    this.productService = productService;
  }

  getByBarcode = async (req, res, next) => {
    try {
      const barcode = req.params.barcode;
      const product = await this.productService.getByBarcode(barcode);

      const productData = {
        id: product.id,
        barcode: product.getBarcodeValue(),
        brandName: product.brandName,
        productName: product.productName,
        category: product.category,
        imageUrl: product.imageUrl,
        hasIngredients: product.hasIngredients(),
        rawIngredients: product.rawIngredientsText,
        safetySummary: product.safetySummary,
        ingredients: product.ingredientsSummary,
        updatedAt: product.updatedAt
      };

      const response = formatSuccessResponse(productData, {
        fields: req.query.fields
      });

      return res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  search = async (req, res, next) => {
    try {
      const query = (req.query.q || "").trim();
      const category = (req.query.category || "").trim();
      const brand = (req.query.brand || "").trim();
      const sort = (req.query.sort || "").trim();
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;

      const result = await this.productService.search({
        query,
        category,
        brand,
        sort,
        limit,
        page
      });

      const items = result.items.map(p => ({
        id: p.id,
        barcode: p.getBarcodeValue(),
        brandName: p.brandName,
        productName: p.productName,
        category: p.category,
        imageUrl: p.imageUrl,
        hasIngredients: p.hasIngredients(),
        safetySummary: p.safetySummary
      }));

      const response = formatSuccessResponse(items, {
        meta: result.meta,
        fields: req.query.fields
      });

      return res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const body = req.body;
      if (!body.productName || !body.barcode) {
        throw new ValidationError("productName ve barcode alanları zorunludur.", [
          { field: "productName", message: "Ürün adı boş olamaz" },
          { field: "barcode", message: "Barkod boş olamaz" }
        ]);
      }

      const result = await this.productService.createOrUpdate(body);
      return res.status(201).json({
        success: true,
        data: {
          id: result.id,
          barcode: result.product.getBarcodeValue(),
          productName: result.product.productName
        }
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProductController;
