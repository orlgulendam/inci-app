// src/modules/community/application/services/ContributionService.js - Katkı ve Ödül Koordinatörü (DIP & ACID)
// Gerekçe: CatalogFacade ve PersonalizationFacade ile Multi-Document ACID transaction içinde onay ve puanlama yürütür.
const Contribution = require("../../domain/entities/Contribution");
const { NotFoundError, ValidationError } = require("../../../../core/errors/AppError");
const eventBus = require("../../../../core/events/eventBus");
const { withTransaction } = require("../../../../core/database/mongo");

class ContributionService {
  constructor(contributionRepository, catalogFacade = null, personalizationFacade = null, transactionRunner = null) {
    this.contributionRepository = contributionRepository;
    this.catalogFacade = catalogFacade;
    this.personalizationFacade = personalizationFacade;
    this.transactionRunner = transactionRunner || withTransaction;
  }

  async submitContribution({ userId, barcode, productName, brandName, rawIngredientsText, imageUrl }) {
    if (!userId) {
      throw new ValidationError("Katkı göndermek için giriş yapmalısınız.");
    }
    if (!barcode || !productName) {
      throw new ValidationError("Barkod ve ürün adı zorunludur.");
    }

    const contribution = new Contribution({
      userId,
      barcode,
      productName,
      brandName: brandName || "Bilinmeyen Marka",
      rawIngredientsText,
      imageUrl
    });

    const id = await this.contributionRepository.save(contribution);

    eventBus.publish("contribution.submitted", {
      id,
      barcode: contribution.barcode,
      productName: contribution.productName,
      userId
    });

    return { id, contribution };
  }

  async listPending({ page = 1, limit = 20 } = {}) {
    return this.contributionRepository.findPending({ page, limit });
  }

  async approveContribution({ contributionId, reviewerNote = null }) {
    if (!contributionId) {
      throw new ValidationError("Katkı ID belirtilmelidir.");
    }

    // MULTI-DOCUMENT ACID TRANSACTION
    // 1) Katkı durumunu 'approved' yap
    // 2) Ürünü resmi kataloğa ekle (CatalogFacade)
    // 3) Katkıyı yapan kullanıcıya 50 puan ver (PersonalizationFacade)
    let approvedContribution = null;

    await this.transactionRunner(async (session) => {
      const contribution = await this.contributionRepository.findById(contributionId, session);
      if (!contribution) {
        throw new NotFoundError(`'${contributionId}' ID'li katkı bulunamadı.`);
      }

      contribution.approve(reviewerNote);
      await this.contributionRepository.save(contribution, session);

      // A) Resmi Kataloğa Ürünü Ekle
      if (this.catalogFacade) {
        await this.catalogFacade.createProductFromContribution({
          barcode: contribution.barcode,
          productName: contribution.productName,
          brandName: contribution.brandName,
          rawIngredientsText: contribution.rawIngredientsText,
          imageUrl: contribution.imageUrl
        });
      }

      // B) Kullanıcıya 50 Puan Ödülü Tanımla
      if (this.personalizationFacade) {
        await this.personalizationFacade.addRewardPoints(contribution.userId, 50, session);
      }

      approvedContribution = contribution;
    });

    // Transaction başarıyla commit edildiğinde olay fırlat
    eventBus.publish("contribution.approved", {
      contributionId,
      barcode: approvedContribution.barcode,
      userId: approvedContribution.userId,
      rewardPoints: 50
    });

    return {
      success: true,
      contribution: approvedContribution,
      rewardAwarded: 50
    };
  }

  async rejectContribution({ contributionId, reason }) {
    if (!contributionId || !reason) {
      throw new ValidationError("Katkı ID ve red gerekçesi zorunludur.");
    }

    const contribution = await this.contributionRepository.findById(contributionId);
    if (!contribution) {
      throw new NotFoundError(`'${contributionId}' ID'li katkı bulunamadı.`);
    }

    contribution.reject(reason);
    await this.contributionRepository.save(contribution);

    eventBus.publish("contribution.rejected", {
      contributionId,
      userId: contribution.userId,
      reason
    });

    return {
      success: true,
      contribution
    };
  }
}

module.exports = ContributionService;
