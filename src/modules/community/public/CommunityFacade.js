// src/modules/community/public/CommunityFacade.js - Cephe Deseni (Facade Pattern)
// Gerekçe: Community modülünün iç karmaşıklığını gizleyerek diğer modüllere temiz bir public API sunmak.

class CommunityFacade {
  constructor(contributionService) {
    this.contributionService = contributionService;
  }

  async submitContribution(data) {
    return this.contributionService.submitContribution(data);
  }

  async getPendingCount() {
    const list = await this.contributionService.listPending({ limit: 1 });
    return list.meta.total;
  }
}

module.exports = CommunityFacade;
