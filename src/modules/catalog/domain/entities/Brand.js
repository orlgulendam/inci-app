// src/modules/catalog/domain/entities/Brand.js - Marka Domain Varlığı (Entity)
class Brand {
  constructor({
    id = null,
    name,
    slug = null,
    originCountry = "TR",
    isVerified = false,
    createdAt = new Date()
  }) {
    if (!name || typeof name !== "string") {
      throw new Error("Marka adı geçerli bir metin olmalıdır.");
    }

    this.id = id;
    this.name = name.trim();
    this.slug = slug || Brand.slugify(this.name);
    this.originCountry = originCountry;
    this.isVerified = !!isVerified;
    this.createdAt = createdAt;
  }

  static slugify(text) {
    return text.toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

module.exports = Brand;
