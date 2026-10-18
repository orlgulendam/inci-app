// src/modules/community/domain/entities/Contribution.js - Topluluk Katkı Domain Varlığı
const ContributionStatus = require("../value-objects/ContributionStatus");

class Contribution {
  constructor({
    id = null,
    userId,
    barcode,
    productName,
    brandName = "Bilinmeyen Marka",
    rawIngredientsText = "",
    imageUrl = null,
    status = ContributionStatus.PENDING,
    reviewerNote = null,
    createdAt = new Date(),
    reviewedAt = null
  }) {
    if (!userId) {
      throw new Error("Katkı için geçerli bir userId gereklidir.");
    }
    if (!barcode || !productName) {
      throw new Error("Katkı için barkod ve ürün adı zorunludur.");
    }

    this.id = id;
    this.userId = userId;
    this.barcode = String(barcode).trim();
    this.productName = productName.trim();
    this.brandName = brandName.trim();
    this.rawIngredientsText = rawIngredientsText ? rawIngredientsText.trim() : "";
    this.imageUrl = imageUrl;
    this.status = status instanceof ContributionStatus ? status : new ContributionStatus(status);
    this.reviewerNote = reviewerNote;
    this.createdAt = createdAt;
    this.reviewedAt = reviewedAt;
  }

  approve(reviewerNote = null) {
    if (!this.status.isPending()) {
      throw new Error(`Sadece 'pending' durumundaki katkılar onaylanabilir. Mevcut durum: ${this.status.value}`);
    }
    this.status = new ContributionStatus(ContributionStatus.APPROVED);
    this.reviewerNote = reviewerNote;
    this.reviewedAt = new Date();
  }

  reject(reason) {
    if (!this.status.isPending()) {
      throw new Error(`Sadece 'pending' durumundaki katkılar reddedilebilir. Mevcut durum: ${this.status.value}`);
    }
    if (!reason || typeof reason !== "string") {
      throw new Error("Reddetme gerekçesi belirtilmelidir.");
    }
    this.status = new ContributionStatus(ContributionStatus.REJECTED);
    this.reviewerNote = reason;
    this.reviewedAt = new Date();
  }
}

module.exports = Contribution;
