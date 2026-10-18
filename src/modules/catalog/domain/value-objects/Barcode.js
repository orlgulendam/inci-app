// src/modules/catalog/domain/value-objects/Barcode.js - Barkod Değer Nesnesi (Value Object)
// Gerekçe: Barkod doğruluğunu ve formatını domain seviyesinde garanti altına almak.

class Barcode {
  constructor(value) {
    if (!value || typeof value !== "string") {
      throw new Error("Barkod geçerli bir metin olmalıdır.");
    }

    const clean = value.trim();
    // 8-14 haneli EAN/UPC formatı kontrolü
    if (!/^\d{8,14}$/.test(clean)) {
      throw new Error(`Geçersiz barkod formatı: '${clean}'. Barkod 8 ile 14 hane arası rakamlardan oluşmalıdır.`);
    }

    this.value = clean;
    Object.freeze(this);
  }

  getValue() {
    return this.value;
  }

  toString() {
    return this.value;
  }
}

module.exports = Barcode;
