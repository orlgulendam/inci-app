// src/modules/analysis/public/AnalysisFacade.js - Cephe Deseni (Facade Pattern)
// Gerekçe: Analysis modülünün iç karmaşıklığını (Tokenizer, RegulationRule, Repository) gizleyip diğer modüllere temiz bir API sunmak.

class AnalysisFacade {
  constructor(analysisService, ingredientRepository) {
    this.analysisService = analysisService;
    this.ingredientRepository = ingredientRepository;
  }

  /**
   * Serbest metni analiz edip özet ve bayrakları döner (Catalog modülü ürün kaydederken çağırır)
   */
  async analyzeText(rawText) {
    return this.analysisService.analyze(rawText);
  }

  /**
   * Tek bir kimyasalın detayını getirir
   */
  async getIngredient(inciName) {
    return this.ingredientRepository.findByInciName(inciName);
  }

  /**
   * Birden fazla kimyasalı toplu sorgular
   */
  async bulkGetIngredients(inciNames) {
    return this.ingredientRepository.bulkFindByInciNames(inciNames);
  }
}

module.exports = AnalysisFacade;
