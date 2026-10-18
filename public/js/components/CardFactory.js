// public/js/components/CardFactory.js - Sonuç Kartı Üretim Fabrikası (Factory Pattern)
// Gerekçe: Farklı durumdaki kartların (uyumluluk analizi, yüklenme skeleton, boş durum, hata) tek bir sözleşme üzerinden tutarlı ve güvenli üretilmesi için.

export class CardFactory {
  /**
   * Cilt uyumluluk analiz sonuç kartı üretir
   * @param {Object} data - Analiz ve uyumluluk verisi
   */
  static createCompatibilityCard(data) {
    const card = document.createElement("article");
    card.className = "card";

    // Header: Ürün adı / Barkod ve Uyumluluk Skoru
    const header = document.createElement("div");
    header.className = "card-header";

    const titleBox = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = data.productName || (data.barcode ? `Barkod: ${data.barcode}` : "Ürün İçerik Analizi");
    titleBox.appendChild(title);

    if (data.brand) {
      const brandSpan = document.createElement("div");
      brandSpan.className = "form-hint";
      brandSpan.textContent = `Marka: ${data.brand}`;
      titleBox.appendChild(brandSpan);
    }
    header.appendChild(titleBox);

    // Skor / Rozet
    const scoreBox = document.createElement("div");
    const score = Number(data.score !== undefined ? data.score : 85);
    const badge = document.createElement("span");

    if (score >= 70) {
      badge.className = "badge badge-success";
      badge.textContent = `Cildinize Uygun (%${score})`;
    } else if (score >= 45) {
      badge.className = "badge badge-warning";
      badge.textContent = `Dikkat (%${score})`;
    } else {
      badge.className = "badge badge-danger";
      badge.textContent = `Uyumsuz (%${score})`;
    }
    scoreBox.appendChild(badge);
    header.appendChild(scoreBox);
    card.appendChild(header);

    // Body: Analiz Ayrıntıları
    const body = document.createElement("div");
    body.className = "card-body";

    // 1. Alerjen ve Hassasiyet Uyarısı
    if (data.matchedAllergens && data.matchedAllergens.length > 0) {
      const allergenBox = document.createElement("div");
      allergenBox.style.padding = "var(--space-3)";
      allergenBox.style.background = "var(--color-danger-bg)";
      allergenBox.style.border = "1px solid var(--color-danger-border)";
      allergenBox.style.borderRadius = "var(--radius-md)";
      allergenBox.style.marginBottom = "var(--space-3)";

      const alertTitle = document.createElement("strong");
      alertTitle.style.color = "var(--color-danger)";
      alertTitle.textContent = "⚠️ Alerjen Uyarısı: ";
      allergenBox.appendChild(alertTitle);

      const alertText = document.createElement("span");
      alertText.textContent = `Cilt profilinizdeki alerjenlerle eşleşen maddeler tespit edildi: ${data.matchedAllergens.join(", ")}`;
      allergenBox.appendChild(alertText);
      body.appendChild(allergenBox);
    }

    // 2. Riskli / Dikkat Edilmesi Gereken İçerikler
    if (data.flaggedIngredients && data.flaggedIngredients.length > 0) {
      const riskBox = document.createElement("div");
      riskBox.style.marginBottom = "var(--space-3)";

      const riskTitle = document.createElement("h4");
      riskTitle.style.fontSize = "var(--font-size-sm)";
      riskTitle.style.color = "var(--color-warning)";
      riskTitle.textContent = "Dikkat Edilmesi Gereken Maddeler:";
      riskBox.appendChild(riskTitle);

      const chipGroup = document.createElement("div");
      chipGroup.className = "chip-group";
      for (const item of data.flaggedIngredients) {
        const chip = document.createElement("span");
        chip.className = "badge badge-warning";
        chip.textContent = typeof item === "string" ? item : (item.name || item.inci_name);
        chipGroup.appendChild(chip);
      }
      riskBox.appendChild(chipGroup);
      body.appendChild(riskBox);
    }

    // 3. Faydalı / Destekleyici İçerikler
    if (data.beneficialIngredients && data.beneficialIngredients.length > 0) {
      const benBox = document.createElement("div");
      benBox.style.marginBottom = "var(--space-3)";

      const benTitle = document.createElement("h4");
      benTitle.style.fontSize = "var(--font-size-sm)";
      benTitle.style.color = "var(--color-success)";
      benTitle.textContent = "Cildinize Faydalı Bileşenler:";
      benBox.appendChild(benTitle);

      const benGroup = document.createElement("div");
      benGroup.className = "chip-group";
      for (const item of data.beneficialIngredients) {
        const chip = document.createElement("span");
        chip.className = "badge badge-success";
        chip.textContent = typeof item === "string" ? item : (item.name || item.inci_name);
        benGroup.appendChild(chip);
      }
      benBox.appendChild(benGroup);
      body.appendChild(benBox);
    }

    // 4. Kısa Yapay Zeka Yorumu
    if (data.aiComment || data.summary) {
      const aiBox = document.createElement("div");
      aiBox.style.padding = "var(--space-3)";
      aiBox.style.background = "var(--color-surface-soft)";
      aiBox.style.border = "1px solid var(--color-border)";
      aiBox.style.borderRadius = "var(--radius-md)";
      aiBox.style.marginBottom = "var(--space-3)";

      const aiLabel = document.createElement("div");
      aiLabel.style.fontSize = "var(--font-size-xs)";
      aiLabel.style.fontWeight = "700";
      aiLabel.style.color = "var(--color-primary-700)";
      aiLabel.textContent = "🤖 Yapay Zeka / Uzman Yorumu:";
      aiBox.appendChild(aiLabel);

      const aiText = document.createElement("p");
      aiText.style.fontSize = "var(--font-size-sm)";
      aiText.style.marginTop = "var(--space-1)";
      aiText.textContent = data.aiComment || data.summary;
      aiBox.appendChild(aiText);

      body.appendChild(aiBox);
    }

    // 5. ZORUNLU SABİT TIBBİ UYARI (Fixed Medical Disclaimer)
    const disclaimer = document.createElement("div");
    disclaimer.className = "medical-disclaimer-banner";
    disclaimer.setAttribute("role", "note");
    disclaimer.innerHTML = `<span><strong>Önemli Uyarı:</strong> Bu bilgiler tıbbi tavsiye değildir, dermatoloğunuza danışın.</span>`;
    body.appendChild(disclaimer);

    card.appendChild(body);
    return card;
  }

  /**
   * Yüklenme durumu için Skeleton Kart üretir
   */
  static createSkeletonCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("aria-busy", "true");
    card.setAttribute("aria-label", "Yükleniyor");

    const body = document.createElement("div");
    body.className = "card-body";

    const titleSkeleton = document.createElement("div");
    titleSkeleton.className = "skeleton skeleton-text short";
    body.appendChild(titleSkeleton);

    const blockSkeleton = document.createElement("div");
    blockSkeleton.className = "skeleton skeleton-block";
    body.appendChild(blockSkeleton);

    const textSkeleton1 = document.createElement("div");
    textSkeleton1.className = "skeleton skeleton-text";
    body.appendChild(textSkeleton1);

    const textSkeleton2 = document.createElement("div");
    textSkeleton2.className = "skeleton skeleton-text short";
    body.appendChild(textSkeleton2);

    card.appendChild(body);
    return card;
  }

  /**
   * Hata durumu kartı üretir
   */
  static createErrorCard(errorMessage, onRetry = null) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.borderColor = "var(--color-danger-border)";

    const body = document.createElement("div");
    body.className = "card-body";
    body.style.textAlign = "center";
    body.style.padding = "var(--space-6)";

    const icon = document.createElement("div");
    icon.style.fontSize = "2.5rem";
    icon.style.marginBottom = "var(--space-2)";
    icon.textContent = "⚠️";
    body.appendChild(icon);

    const title = document.createElement("h3");
    title.style.color = "var(--color-danger)";
    title.style.marginBottom = "var(--space-2)";
    title.textContent = "Bir Hata Oluştu";
    body.appendChild(title);

    const text = document.createElement("p");
    text.style.fontSize = "var(--font-size-sm)";
    text.style.color = "var(--color-text-muted)";
    text.style.marginBottom = "var(--space-4)";
    text.textContent = errorMessage || "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyiniz.";
    body.appendChild(text);

    if (typeof onRetry === "function") {
      const retryBtn = document.createElement("button");
      retryBtn.className = "btn btn-secondary";
      retryBtn.textContent = "Tekrar Dene";
      retryBtn.onclick = onRetry;
      body.appendChild(retryBtn);
    }

    card.appendChild(body);
    return card;
  }

  /**
   * Boş durum kartı üretir
   */
  static createEmptyCard(message = "Henüz taranmış bir ürün bulunmuyor.") {
    const card = document.createElement("div");
    card.className = "card";

    const body = document.createElement("div");
    body.className = "card-body";
    body.style.textAlign = "center";
    body.style.padding = "var(--space-8) var(--space-4)";

    const icon = document.createElement("div");
    icon.style.fontSize = "2.5rem";
    icon.style.marginBottom = "var(--space-2)";
    icon.textContent = "🧴";
    body.appendChild(icon);

    const text = document.createElement("p");
    text.style.color = "var(--color-text-muted)";
    text.style.fontSize = "var(--font-size-sm)";
    text.textContent = message;
    body.appendChild(text);

    card.appendChild(body);
    return card;
  }
}
