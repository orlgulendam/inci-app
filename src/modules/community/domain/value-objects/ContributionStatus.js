// src/modules/community/domain/value-objects/ContributionStatus.js - Katkı Durumu Değer Nesnesi
class ContributionStatus {
  static PENDING = "pending";
  static APPROVED = "approved";
  static REJECTED = "rejected";

  constructor(status = ContributionStatus.PENDING) {
    const valid = [ContributionStatus.PENDING, ContributionStatus.APPROVED, ContributionStatus.REJECTED];
    if (!valid.includes(status)) {
      throw new Error(`Geçersiz katkı durumu: ${status}`);
    }
    this.value = status;
    Object.freeze(this);
  }

  isPending() {
    return this.value === ContributionStatus.PENDING;
  }

  isApproved() {
    return this.value === ContributionStatus.APPROVED;
  }

  isRejected() {
    return this.value === ContributionStatus.REJECTED;
  }

  toString() {
    return this.value;
  }
}

module.exports = ContributionStatus;
