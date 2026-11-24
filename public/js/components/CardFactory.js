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
    // Skor YOKSA uydurulmaz. Önceden varsayılan 85 kullanıldığı için içerik verisi
    // olmayan veya sözleşmesi uyuşmayan her ürün ekranda "Cildinize Uygun (%85)" görünüyordu.
    const scoreBox = document.createElement("div");
    const hasScore = data.score !== undefined && data.score !== null && !Number.isNaN(Number(data.score));
    const score = hasScore ? Number(data.score) : null;
    const badge = document.createElement("span");

    const hasAllergenWarning = data.matchedAllergens && data.matchedAllergens.length > 0;

    if (!hasScore) {
      badge.className = "badge badge-warning";
      badge.textContent = "İçerik Verisi Eksik";
      badge.title = "Bu ürünün INCI listesi bulunmadığı için uyumluluk skoru hesaplanamadı.";
    } else if (score >= 70 && !hasAllergenWarning) {
      badge.className = "badge badge-success";
      badge.textContent = `Cildinize Uygun (%${score})`;
    } else if (score >= 45 && !hasAllergenWarning) {
      badge.className = "badge badge-warning";
      badge.textContent = `Dikkat (%${score})`;
    } else {
      badge.className = "badge badge-danger";
      badge.textContent = hasAllergenWarning ? `Alerjen Riski (%${score})` : `Uyumsuz (%${score})`;
    }
    scoreBox.appendChild(badge);
    header.appendChild(scoreBox);
    card.appendChild(header);

    // Body: Analiz Ayrıntıları
    const body = document.createElement("div");
    body.className = "card-body";

    // MASKOT DUYGU DURUMU (INCI Mascot Integration)
    const mascotBox = document.createElement("div");
    const isSuccess = hasScore && score >= 70 && !hasAllergenWarning;
    mascotBox.className = `mascot-sprite-box ${isSuccess ? "success" : "alert"}`;
    mascotBox.setAttribute("aria-label", isSuccess ? "Mükemmel Uyum Maskotu" : "Uyarı Risk Maskotu");

    const spriteImg = document.createElement("img");
    spriteImg.src = "/assets/mascot/inci_mascot_modes.jpg";
    spriteImg.alt = isSuccess ? "INCI Başarı Modu" : "INCI Uyarı Modu";
    spriteImg.className = "mascot-sprite-img";
    mascotBox.appendChild(spriteImg);
    body.appendChild(mascotBox);

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

    // 1.5 Kimyasal Çakışma ve Bariyer Uyarısı (Ingredient Conflict Alert)
    if (data.conflicts && data.conflicts.hasConflicts) {
      const conflictBox = document.createElement("div");
      conflictBox.style.padding = "var(--space-3)";
      const isHigh = data.conflicts.overallRisk === "HIGH";
      conflictBox.style.background = isHigh ? "#FFF0F0" : "#FFFBEB";
      conflictBox.style.border = `1px solid ${isHigh ? "#F87171" : "#FBBF24"}`;
      conflictBox.style.borderRadius = "var(--radius-md)";
      conflictBox.style.marginBottom = "var(--space-3)";

      const conflictTitle = document.createElement("div");
      conflictTitle.style.fontWeight = "700";
      conflictTitle.style.fontSize = "13px";
      conflictTitle.style.color = isHigh ? "#B91C1C" : "#B45309";
      conflictTitle.innerHTML = `⚠️ Kimyasal Çakışma & Bariyer Alarmı (${data.conflicts.overallRisk} Risk):`;
      conflictBox.appendChild(conflictTitle);

      data.conflicts.conflicts.forEach((c) => {
        const item = document.createElement("div");
        item.style.fontSize = "12px";
        item.style.marginTop = "4px";
        item.style.color = "#374151";
        item.innerHTML = `
          <strong>${c.title}</strong> (${c.triggerA} ⚡ ${c.triggerB})<br/>
          <span style="font-size: 11px; color: #6B7280;">${c.description}</span><br/>
          <span style="font-size: 11px; color: #047857; font-weight: 600;">💡 Tavsiye: ${c.dermatologistAdvice}</span>
        `;
        conflictBox.appendChild(item);
      });
      body.appendChild(conflictBox);
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

    // 6. Hatalı İçerik Bildir (+20 İnci)
    const reportBox = document.createElement("div");
    reportBox.style.marginTop = "var(--space-3)";
    reportBox.style.paddingTop = "var(--space-2)";
    reportBox.style.borderTop = "1px dashed var(--color-border)";
    reportBox.style.display = "flex";
    reportBox.style.justifyContent = "space-between";
    reportBox.style.alignItems = "center";
    reportBox.style.flexWrap = "wrap";
    reportBox.style.gap = "var(--space-2)";

    const actionsContainer = document.createElement("div");
    actionsContainer.style.display = "flex";
    actionsContainer.style.gap = "8px";
    actionsContainer.style.flexWrap = "wrap";

    // Dijital Dolaba Ekle Butonu
    const vanityBtn = document.createElement("button");
    vanityBtn.type = "button";
    vanityBtn.className = "btn btn-secondary btn-sm";
    vanityBtn.style.fontSize = "11px";
    vanityBtn.style.padding = "4px 10px";
    vanityBtn.innerHTML = "🧴 Dolabıma Ekle (SKT Takibi)";
    vanityBtn.onclick = () => {
      if (typeof data.onAddToVanity === "function") {
        data.onAddToVanity();
      } else {
        window.dispatchEvent(new CustomEvent("add-to-vanity-requested", {
          detail: {
            barcode: data.barcode,
            productName: data.productName,
            brand: data.brand
          }
        }));
      }
    };
    actionsContainer.appendChild(vanityBtn);

    const reportBtn = document.createElement("button");
    reportBtn.type = "button";
    reportBtn.className = "btn btn-outline btn-sm";
    reportBtn.style.fontSize = "11px";
    reportBtn.style.padding = "4px 10px";
    reportBtn.innerHTML = "⚠️ Hata Bildir (+20 İnci)";
    reportBtn.onclick = () => {
      if (typeof data.onReportIssue === "function") {
        data.onReportIssue();
      } else {
        window.dispatchEvent(new CustomEvent("report-product-issue", {
          detail: {
            barcode: data.barcode,
            productName: data.productName
          }
        }));
      }
    };
    actionsContainer.appendChild(reportBtn);

    reportBox.appendChild(actionsContainer);
    body.appendChild(reportBox);

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
    body.style.textAlign = "center";

    // Tarama Modu Maskotu
    const mascotBox = document.createElement("div");
    mascotBox.className = "mascot-sprite-box scanning";
    const spriteImg = document.createElement("img");
    spriteImg.src = "/assets/mascot/inci_mascot_modes.jpg";
    spriteImg.alt = "Analiz Ediyor...";
    spriteImg.className = "mascot-sprite-img";
    mascotBox.appendChild(spriteImg);
    body.appendChild(mascotBox);

    const titleSkeleton = document.createElement("div");
    titleSkeleton.className = "skeleton skeleton-text short";
    titleSkeleton.style.margin = "0 auto var(--space-3) auto";
    body.appendChild(titleSkeleton);

    const blockSkeleton = document.createElement("div");
    blockSkeleton.className = "skeleton skeleton-block";
    body.appendChild(blockSkeleton);

    const textSkeleton1 = document.createElement("div");
    textSkeleton1.className = "skeleton skeleton-text";
    body.appendChild(textSkeleton1);

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
