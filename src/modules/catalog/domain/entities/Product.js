// src/modules/catalog/domain/entities/Product.js - Ürün Domain Varlığı (Entity)
const Barcode = require("../value-objects/Barcode");

class Product {
  constructor({
    id = null,
    barcode,
    brandId = null,
    brandName = "Bilinmeyen Marka",
    productName,
    category = "skincare",
    imageUrl = null,
    rawIngredientsText = "",
    ingredientsSummary = [],
    safetySummary = null,
    isVerified = true,
    updatedAt = new Date()
  }) {
    if (!productName || typeof productName !== "string") {
      throw new Error("Ürün adı geçerli bir metin olmalıdır.");
    }

    // Barcode nesnesi üzerinden doğrula
    this.barcode = barcode instanceof Barcode ? barcode : new Barcode(barcode);
    this.id = id;
    this.brandId = brandId;
    this.brandName = brandName.trim();
    this.productName = productName.trim();
    this.category = category;
    this.imageUrl = imageUrl;
    this.rawIngredientsText = rawIngredientsText;
    this.ingredientsSummary = Array.isArray(ingredientsSummary) ? ingredientsSummary : [];
    this.safetySummary = safetySummary;
    this.isVerified = !!isVerified;
    this.updatedAt = updatedAt;
  }

  getBarcodeValue() {
    return this.barcode.getValue();
  }

  hasIngredients() {
    return (
      (this.rawIngredientsText && this.rawIngredientsText.length > 3) ||
      this.ingredientsSummary.length > 0
    );
  }
}

module.exports = Product;
