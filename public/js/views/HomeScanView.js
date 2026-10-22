// public/js/views/HomeScanView.js - Ana Sayfa ve Ürün Tarama Görünümü (SRP & Strategy)
// Gerekçe: 3 tarama yöntemini (Canlı Kamera, Fotoğraf Çekme/Yükleme, Manuel Giriş) tek bir arayüzde birleştirmek ve sonuçları CardFactory ile sunmak için.
import { ScannerService, scannerService } from "../scanner/ScannerService.js";
import { scanService } from "../services/scanService.js";
import { communityService } from "../services/communityService.js";
import { store } from "../state/store.js";
import { CardFactory } from "../components/CardFactory.js";
import { toast } from "../components/Toast.js";

export class HomeScanView {
  constructor(container) {
    this.container = container;
    this.isCameraModalOpen = false;
  }

  render() {
    this.container.innerHTML = "";

    const viewWrapper = document.createElement("div");
    viewWrapper.className = "home-scan-view";

    // Hero / Başlık & Sevimli Maskot Kartı (skinbyinci Mascot Hero)
    const heroCard = document.createElement("section");
    heroCard.className = "mascot-hero-card";

    const mascotImg = document.createElement("img");
    mascotImg.src = "/assets/mascot/inci_mascot_shell.jpg";
    mascotImg.alt = "AI Cilt Asistanı İnci";
    mascotImg.className = "mascot-img-large";
    heroCard.appendChild(mascotImg);

    const title = document.createElement("h1");
    title.style.color = "var(--color-primary-800)";
    title.style.fontSize = "var(--font-size-xl)";
    title.style.fontWeight = "800";
    title.style.marginTop = "var(--space-2)";
    title.style.marginBottom = "var(--space-1)";
    title.textContent = "skinbyinci";
    heroCard.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.style.color = "var(--color-text-muted)";
    subtitle.style.maxWidth = "500px";
    subtitle.style.fontSize = "var(--font-size-sm)";
    subtitle.textContent = "Barkodu tara veya fotoğrafını çek; AI Cilt Asistanı İnci ürünün cildinize uyumunu saniyeler içinde analiz etsin!";
    heroCard.appendChild(subtitle);
    viewWrapper.appendChild(heroCard);

    // Tarama Seçenekleri Kartı (3 Yöntem Stratejisi)
    const scanCard = document.createElement("div");
    scanCard.className = "card";

    const scanHeader = document.createElement("div");
    scanHeader.className = "card-header";
    const scanTitle = document.createElement("h2");
    scanTitle.className = "card-title";
    scanTitle.textContent = "Ürünü İnceleyin";
    scanHeader.appendChild(scanTitle);
    scanCard.appendChild(scanHeader);

    const scanBody = document.createElement("div");
    scanBody.className = "card-body";

    // 1. Canlı Kamera & Fotoğraf Çekme Butonları
    const actionGrid = document.createElement("div");
    actionGrid.style.display = "grid";
    actionGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
    actionGrid.style.gap = "var(--space-3)";
    actionGrid.style.marginBottom = "var(--space-5)";

    // Kamera Butonu
    const cameraBtn = document.createElement("button");
    cameraBtn.className = "btn btn-primary";
    cameraBtn.innerHTML = `<span>📷 Canlı Kamera ile Tara</span>`;
    cameraBtn.onclick = () => this.openCameraModal();
    actionGrid.appendChild(cameraBtn);

    // Fotoğraf Çek / Yükle Butonu & Gizli Input
    const fileLabel = document.createElement("label");
    fileLabel.className = "btn btn-secondary";
    fileLabel.style.cursor = "pointer";
    fileLabel.innerHTML = `<span>🖼️ Fotoğraf Çek / Yükle</span>`;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.setAttribute("capture", "environment");
    fileInput.style.display = "none";
    fileInput.onchange = (e) => this.handleImageUpload(e);
    fileLabel.appendChild(fileInput);
    actionGrid.appendChild(fileLabel);

    scanBody.appendChild(actionGrid);

    // Ayırıcı
    const divider = document.createElement("div");
    divider.style.textAlign = "center";
    divider.style.margin = "var(--space-4) 0";
    divider.style.position = "relative";
    divider.innerHTML = `<span style="background:#fff; padding: 0 var(--space-3); color:var(--color-text-subtle); font-size:var(--font-size-xs); font-weight:600;">VEYA MANUEL GİRİŞ</span>`;
    scanBody.appendChild(divider);

    // 2. Manuel Barkod Giriş Formu
    const barcodeForm = document.createElement("form");
    barcodeForm.style.display = "flex";
    barcodeForm.style.gap = "var(--space-2)";
    barcodeForm.style.marginBottom = "var(--space-4)";
    barcodeForm.onsubmit = (e) => {
      e.preventDefault();
      const val = barcodeInput.value.trim();
      if (val) this.processBarcode(val);
    };

    const barcodeInput = document.createElement("input");
    barcodeInput.className = "form-input";
    barcodeInput.placeholder = "Barkod Numarası (Örn: 8690123456789)";
    barcodeInput.setAttribute("aria-label", "Barkod Numarası");
    barcodeForm.appendChild(barcodeInput);

    const submitBarcodeBtn = document.createElement("button");
    submitBarcodeBtn.type = "submit";
    submitBarcodeBtn.className = "btn btn-primary";
    submitBarcodeBtn.textContent = "Sorgula";
    barcodeForm.appendChild(submitBarcodeBtn);

    scanBody.appendChild(barcodeForm);

    // 3. Serbest INCI İçerik Metni Girişi
    const rawTextDetails = document.createElement("details");
    rawTextDetails.style.marginTop = "var(--space-3)";
    rawTextDetails.style.fontSize = "var(--font-size-sm)";

    const rawSummary = document.createElement("summary");
    rawSummary.style.cursor = "pointer";
    rawSummary.style.color = "var(--color-primary-700)";
    rawSummary.style.fontWeight = "600";
    rawSummary.textContent = "✍️ Ya da ürün üzerindeki içerik (INCI) metnini yapıştırın";
    rawTextDetails.appendChild(rawSummary);

    const rawForm = document.createElement("form");
    rawForm.style.marginTop = "var(--space-3)";
    rawForm.onsubmit = (e) => {
      e.preventDefault();
      const val = rawTextarea.value.trim();
      if (val) this.processRawIngredients(val);
    };

    const rawTextarea = document.createElement("textarea");
    rawTextarea.className = "form-textarea";
    rawTextarea.placeholder = "Örnek: Aqua, Glycerin, Niacinamide, Dimethicone, Phenoxyethanol...";
    rawForm.appendChild(rawTextarea);

    const submitRawBtn = document.createElement("button");
    submitRawBtn.type = "submit";
    submitRawBtn.className = "btn btn-secondary";
    submitRawBtn.style.marginTop = "var(--space-2)";
    submitRawBtn.textContent = "İçerikleri Analiz Et";
    rawForm.appendChild(submitRawBtn);

    rawTextDetails.appendChild(rawForm);
    scanBody.appendChild(rawTextDetails);

    scanCard.appendChild(scanBody);
    viewWrapper.appendChild(scanCard);

    // Sonuç Konteyneri
    this.resultsContainer = document.createElement("div");
    this.resultsContainer.className = "results-section";
    this.resultsContainer.appendChild(CardFactory.createEmptyCard("Henüz taranmış veya sorgulanmış bir ürün bulunmuyor."));
    viewWrapper.appendChild(this.resultsContainer);

    this.container.appendChild(viewWrapper);
  }

  /**
   * Canlı Kamera Modal Penceresini Açar
   */
  openCameraModal() {
    this.isCameraModalOpen = true;

    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.id = "cameraModal";

    const modalBox = document.createElement("div");
    modalBox.className = "modal-container";

    const modalHeader = document.createElement("div");
    modalHeader.className = "card-header";
    const headerTitle = document.createElement("h3");
    headerTitle.className = "card-title";
    headerTitle.textContent = "Barkod Tarayıcı";
    modalHeader.appendChild(headerTitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-sm btn-outline";
    closeBtn.textContent = "✕ Kapat";
    closeBtn.onclick = () => this.closeCameraModal();
    modalHeader.appendChild(closeBtn);
    modalBox.appendChild(modalHeader);

    // Kamera Vizör Alanı
    const viewfinder = document.createElement("div");
    viewfinder.className = "camera-viewfinder-container";

    const video = document.createElement("video");
    video.className = "camera-video";
    video.setAttribute("playsinline", "true");
    viewfinder.appendChild(video);

    const guideBox = document.createElement("div");
    guideBox.className = "camera-guide-box";
    viewfinder.appendChild(guideBox);
    modalBox.appendChild(viewfinder);

    const modalFooter = document.createElement("div");
    modalFooter.className = "card-footer";
    modalFooter.style.fontSize = "var(--font-size-xs)";
    modalFooter.style.textAlign = "center";
    modalFooter.style.display = "flex";
    modalFooter.style.flexDirection = "column";
    modalFooter.style.gap = "var(--space-2)";

    const ocrSnapBtn = document.createElement("button");
    ocrSnapBtn.type = "button";
    ocrSnapBtn.className = "btn btn-secondary btn-sm";
    ocrSnapBtn.innerHTML = "📸 İçerik (INCI) Yazısını Fotoğrafla ve Oku (OCR)";
    ocrSnapBtn.onclick = async () => {
      const frameBlob = await scannerService.captureFrameFromVideo();
      this.closeCameraModal();
      if (frameBlob) {
        toast.info("Kameradan kare alındı, içerik metni taranıyor...");
        await this.processOcrImage(frameBlob);
      } else {
        toast.error("Kameradan görüntü alınamadı.");
      }
    };
    modalFooter.appendChild(ocrSnapBtn);

    const helpText = document.createElement("div");
    helpText.style.color = "var(--color-text-subtle)";
    helpText.textContent = "Barkodu kutucuğa hizalayın veya ambalaj üzerindeki 'Ingredients' yazısını çekmek için yukarıdaki butona basınız.";
    modalFooter.appendChild(helpText);

    modalBox.appendChild(modalFooter);

    modalBackdrop.appendChild(modalBox);
    document.body.appendChild(modalBackdrop);

    // Kamerayı Başlat
    scannerService.startLiveCamera(
      video,
      (detectedBarcode) => {
        this.closeCameraModal();
        toast.success(`Barkod okundu: ${detectedBarcode}`);
        this.processBarcode(detectedBarcode);
      },
      (error) => {
        this.closeCameraModal();
        toast.error(error.message);
      }
    );
  }

  closeCameraModal() {
    this.isCameraModalOpen = false;
    scannerService.stopCamera();
    const modal = document.getElementById("cameraModal");
    if (modal) modal.remove();
  }

  /**
   * Fotoğraf yükleme ve istemci optimizasyonu
   */
  async handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info("Görsel işleniyor ve optimize ediliyor...");
      const optimizedBlob = await ScannerService.resizeAndStripExif(file, 1200);

      // Fotoğraf üzerinden barkod / OCR analizi
      const img = new Image();
      img.src = URL.createObjectURL(optimizedBlob);
      img.onload = async () => {
        const strategy = await scannerService.resolveStrategy();
        const barcode = await strategy.detect(img);

        if (barcode) {
          toast.success(`Görselden barkod tespit edildi: ${barcode}`);
          this.processBarcode(barcode);
        } else {
          // Barkod bulunamadıysa akıllı OCR motoru ambalajdaki metni okumaya geçer
          toast.info("Barkod bulunamadı, ambalajdaki 'İçindekiler (INCI)' metni taranıyor...");
          await this.processOcrImage(optimizedBlob);
        }
      };
    } catch (err) {
      toast.error(err.message);
    }
  }

  /**
   * Görselden OCR ile içerik listesi ayıklar ve kullanıcıya önizleme sunar
   */
  async processOcrImage(imageSource) {
    try {
      this.resultsContainer.innerHTML = "";
      this.resultsContainer.appendChild(CardFactory.createSkeletonCard());

      const ocrResult = await scannerService.recognizeOcr(imageSource);

      if (!ocrResult || !ocrResult.ingredientsText || ocrResult.ingredientsText.trim().length < 3) {
        toast.warning(
          ocrResult?.error ||
          "Görselden net bir içerik listesi okunamadı. Lütfen ışığı ayarlayarak ambalajdaki 'Ingredients' kısmını daha yakından çekiniz veya metni manuel giriniz."
        );
        this.resultsContainer.innerHTML = "";
        this.resultsContainer.appendChild(
          CardFactory.createEmptyCard("Net bir içerik metni tespit edilemedi. Lütfen fotoğrafı tekrar çekiniz veya metni aşağıya yapıştırınız.")
        );
        return;
      }

      toast.success("Ambalaj metni başarıyla okundu!");
      this.openOcrPreviewModal(ocrResult);
    } catch (err) {
      toast.error(`OCR İşlemi Başarısız: ${err.message}`);
      this.resultsContainer.innerHTML = "";
    }
  }

  /**
   * OCR ile tespit edilen içerik metnini kullanıcıya onaylatan ve düzenleten modal
   */
  openOcrPreviewModal(ocrResult) {
    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.id = "ocrPreviewModal";

    const modalBox = document.createElement("div");
    modalBox.className = "modal-container";
    modalBox.style.maxWidth = "520px";

    const modalHeader = document.createElement("div");
    modalHeader.className = "card-header";
    const headerTitle = document.createElement("h3");
    headerTitle.className = "card-title";
    headerTitle.innerHTML = "✨ Tespit Edilen İçerik Metni (OCR)";
    modalHeader.appendChild(headerTitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-sm btn-outline";
    closeBtn.textContent = "✕ Kapat";
    closeBtn.onclick = () => modalBackdrop.remove();
    modalHeader.appendChild(closeBtn);
    modalBox.appendChild(modalHeader);

    const modalBody = document.createElement("div");
    modalBody.className = "card-body";

    // Ürün veya Marka tespiti varsa rozet olarak göster
    if (ocrResult.detectedProductName || ocrResult.detectedBrand) {
      const detectedInfo = document.createElement("div");
      detectedInfo.style.marginBottom = "var(--space-3)";
      detectedInfo.style.padding = "var(--space-2) var(--space-3)";
      detectedInfo.style.background = "var(--color-primary-50)";
      detectedInfo.style.borderRadius = "var(--radius-md)";
      detectedInfo.style.fontSize = "var(--font-size-xs)";
      detectedInfo.style.color = "var(--color-primary-800)";
      detectedInfo.innerHTML = `🏷️ <strong>Tespit Edilen:</strong> ${ocrResult.detectedBrand || ""} ${ocrResult.detectedProductName || ""}`;
      modalBody.appendChild(detectedInfo);
    }

    const description = document.createElement("p");
    description.style.fontSize = "var(--font-size-xs)";
    description.style.color = "var(--color-text-muted)";
    description.style.marginBottom = "var(--space-2)";
    description.textContent = "Ambalajdan okunan kimyasal bileşenler aşağıdadır. Yanlış okunan harf varsa düzeltebilir veya doğrudan analizi başlatabilirsiniz:";
    modalBody.appendChild(description);

    const textarea = document.createElement("textarea");
    textarea.className = "form-textarea";
    textarea.style.minHeight = "120px";
    textarea.style.fontSize = "var(--font-size-sm)";
    textarea.value = ocrResult.ingredientsText;
    modalBody.appendChild(textarea);

    const modalActions = document.createElement("div");
    modalActions.style.display = "flex";
    modalActions.style.flexWrap = "wrap";
    modalActions.style.gap = "var(--space-2)";
    modalActions.style.marginTop = "var(--space-4)";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.type = "button";
    analyzeBtn.className = "btn btn-primary";
    analyzeBtn.style.flex = "1 1 180px";
    analyzeBtn.innerHTML = "🧪 Bu İçerikleri Analiz Et";
    analyzeBtn.onclick = () => {
      const editedText = textarea.value.trim();
      modalBackdrop.remove();
      if (editedText) {
        this.processRawIngredients(editedText);
      }
    };
    modalActions.appendChild(analyzeBtn);

    const contributeBtn = document.createElement("button");
    contributeBtn.type = "button";
    contributeBtn.className = "btn btn-secondary";
    contributeBtn.style.flex = "1 1 180px";
    contributeBtn.innerHTML = "🤝 Bu Ürünü Sisteme Ekle (+50 Puan)";
    contributeBtn.onclick = () => {
      const editedText = textarea.value.trim();
      modalBackdrop.remove();
      this.openContributionModal({
        productName: ocrResult.detectedProductName || "",
        brandName: ocrResult.detectedBrand || "",
        rawIngredientsText: editedText
      });
    };
    modalActions.appendChild(contributeBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-outline";
    cancelBtn.textContent = "İptal";
    cancelBtn.onclick = () => modalBackdrop.remove();
    modalActions.appendChild(cancelBtn);

    modalBody.appendChild(modalActions);
    modalBox.appendChild(modalBody);
    modalBackdrop.appendChild(modalBox);
    document.body.appendChild(modalBackdrop);
  }

  /**
   * Barkod analizi gerçekleştirir
   */
  async processBarcode(barcode) {
    this.resultsContainer.innerHTML = "";
    this.resultsContainer.appendChild(CardFactory.createSkeletonCard());

    try {
      const result = await scanService.checkBarcodeCompatibility(barcode);

      // Streak puanı kazanıldıysa kullanıcıyı tebrik et
      if (result.streak && result.streak.pointsAwarded > 0) {
        toast.success(`🔥 Günlük İnci Serisi! +${result.streak.pointsAwarded} İnci kazandınız (${result.streak.streakCount}. Gün)`);
      }

      this.resultsContainer.innerHTML = "";
      this.resultsContainer.appendChild(CardFactory.createCompatibilityCard({
        barcode,
        productName: result.product?.name,
        brand: result.product?.brand,
        score: result.compatibilityScore || 85,
        matchedAllergens: result.matchedAllergens || [],
        flaggedIngredients: result.flaggedIngredients || [],
        beneficialIngredients: result.beneficialIngredients || [],
        aiComment: result.analysisComment || result.summary,
        onReportIssue: () => this.openReportIssueModal({ barcode, productName: result.product?.name })
      }));
    } catch (err) {
      this.resultsContainer.innerHTML = "";

      const notFoundCard = document.createElement("div");
      notFoundCard.className = "card";
      notFoundCard.style.borderTop = "4px solid var(--color-primary-500)";
      notFoundCard.style.textAlign = "center";
      notFoundCard.style.padding = "var(--space-5)";

      notFoundCard.innerHTML = `
        <div style="font-size: 2.8rem; margin-bottom: var(--space-2);">✨</div>
        <h3 style="color: var(--color-primary-800); margin-bottom: var(--space-2);">'${barcode}' Barkodu Henüz Kayıtlı Değil</h3>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); max-width: 440px; margin: 0 auto var(--space-4) auto;">
          Bu ürünü topluluğumuzda ilk keşfeden sen olabilirsin! Ürünün adını ve içeriklerini sisteme ekle, <strong>50 Puan</strong> kazan.
        </p>
      `;

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-primary";
      addBtn.innerHTML = "➕ Bu Ürünü Sisteme Ekle (+50 Puan)";
      addBtn.onclick = () => {
        this.openContributionModal({ barcode });
      };
      notFoundCard.appendChild(addBtn);

      this.resultsContainer.appendChild(notFoundCard);
    }
  }

  /**
   * Topluluğa yeni ürün katkısı gönderme modalı (+50 Puan)
   */
  openContributionModal({ barcode = "", productName = "", brandName = "", rawIngredientsText = "" } = {}) {
    if (!store.isAuthenticated()) {
      toast.warning("Katkı göndermek ve 50 puan kazanmak için lütfen önce giriş yapınız.");
      return;
    }

    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.id = "contributionModal";

    const modalBox = document.createElement("div");
    modalBox.className = "modal-container";
    modalBox.style.maxWidth = "520px";

    const modalHeader = document.createElement("div");
    modalHeader.className = "card-header";
    const headerTitle = document.createElement("h3");
    headerTitle.className = "card-title";
    headerTitle.innerHTML = "🎁 Ürün Katkısı Gönder (+50 Puan)";
    modalHeader.appendChild(headerTitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-sm btn-outline";
    closeBtn.textContent = "✕ Kapat";
    closeBtn.onclick = () => modalBackdrop.remove();
    modalHeader.appendChild(closeBtn);
    modalBox.appendChild(modalHeader);

    const modalBody = document.createElement("div");
    modalBody.className = "card-body";

    const introText = document.createElement("p");
    introText.style.fontSize = "var(--font-size-xs)";
    introText.style.color = "var(--color-text-muted)";
    introText.style.marginBottom = "var(--space-3)";
    introText.textContent = "Girdiğiniz ürün moderatör onayından geçtikten sonra kalıcı olarak kataloğa eklenecek ve hesabınıza 50 Puan yüklenecektir.";
    modalBody.appendChild(introText);

    const form = document.createElement("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const bcode = formBarcode.value.trim();
      const pName = formPName.value.trim();
      const bName = formBName.value.trim();
      const ingText = formIng.value.trim();

      if (!bcode || !pName) {
        toast.warning("Barkod ve ürün adı zorunludur.");
        return;
      }

      try {
        toast.info("Katkınız gönderiliyor...");
        await communityService.submitContribution({
          barcode: bcode,
          productName: pName,
          brandName: bName || "Bilinmeyen Marka",
          rawIngredientsText: ingText
        });

        modalBackdrop.remove();
        toast.success("Tebrikler! Katkınız moderatör onayına iletildi. Onaylandığında 50 puan hesabınıza eklenecek.");
      } catch (err) {
        toast.error(`Gönderim başarısız: ${err.message}`);
      }
    };

    // Barkod Alanı
    const formBarcode = document.createElement("input");
    formBarcode.className = "form-input";
    formBarcode.style.marginBottom = "var(--space-3)";
    formBarcode.placeholder = "Barkod (8-14 hane)";
    formBarcode.value = barcode || (Date.now().toString()); // Barkod yoksa geçici zaman kodu
    form.appendChild(formBarcode);

    // Marka Adı Alanı
    const formBName = document.createElement("input");
    formBName.className = "form-input";
    formBName.style.marginBottom = "var(--space-3)";
    formBName.placeholder = "Marka Adı (Örn: The Purest Solutions, CeraVe)";
    formBName.value = brandName;
    form.appendChild(formBName);

    // Ürün Adı Alanı
    const formPName = document.createElement("input");
    formPName.className = "form-input";
    formPName.style.marginBottom = "var(--space-3)";
    formPName.placeholder = "Ürün Adı (Örn: Nemlendirici Bariyer Krem)";
    formPName.value = productName;
    form.appendChild(formPName);

    // İçerik (INCI) Metni
    const formIng = document.createElement("textarea");
    formIng.className = "form-textarea";
    formIng.style.minHeight = "90px";
    formIng.style.marginBottom = "var(--space-3)";
    formIng.placeholder = "İçerik (INCI) Listesi: Aqua, Glycerin, Niacinamide...";
    formIng.value = rawIngredientsText;
    form.appendChild(formIng);

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary";
    submitBtn.style.width = "100%";
    submitBtn.innerHTML = "🚀 Katkıyı Gönder ve 50 Puan Kazan";
    form.appendChild(submitBtn);

    modalBody.appendChild(form);
    modalBox.appendChild(modalBody);
    modalBackdrop.appendChild(modalBox);
    document.body.appendChild(modalBackdrop);
  }

  /**
   * Hatalı içerik bildirme modalı (+20 İnci)
   */
  openReportIssueModal({ barcode = "", productName = "" } = {}) {
    if (!store.isAuthenticated()) {
      toast.warning("Hatalı içerik bildirip 20 puan kazanmak için lütfen giriş yapınız.");
      return;
    }

    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.id = "reportIssueModal";

    const modalBox = document.createElement("div");
    modalBox.className = "modal-container";
    modalBox.style.maxWidth = "480px";

    const modalHeader = document.createElement("div");
    modalHeader.className = "card-header";
    const headerTitle = document.createElement("h3");
    headerTitle.className = "card-title";
    headerTitle.innerHTML = "⚠️ Hatalı İçerik Bildir (+20 İnci)";
    modalHeader.appendChild(headerTitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-sm btn-outline";
    closeBtn.textContent = "✕ Kapat";
    closeBtn.onclick = () => modalBackdrop.remove();
    modalHeader.appendChild(closeBtn);
    modalBox.appendChild(modalHeader);

    const modalBody = document.createElement("div");
    modalBody.className = "card-body";

    const form = document.createElement("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const desc = descInput.value.trim();
      const corr = corrInput.value.trim();

      if (!desc) {
        toast.warning("Lütfen tespit ettiğiniz hatayı açıklayınız.");
        return;
      }

      try {
        toast.info("Bildiriminiz iletiliyor...");
        await communityService.reportIssue({
          barcode: barcode || "MANUAL",
          productName: productName || "Kayıtlı Ürün",
          issueDescription: desc,
          suggestedCorrection: corr
        });
        modalBackdrop.remove();
        toast.success("Bildiriminiz alındı! İçerik düzeltildiğinde 20 İnci hesabınıza yüklenecektir.");
      } catch (err) {
        toast.error(`Bildirim gönderilemedi: ${err.message}`);
      }
    };

    const infoP = document.createElement("p");
    infoP.style.fontSize = "var(--font-size-xs)";
    infoP.style.color = "var(--color-text-muted)";
    infoP.style.marginBottom = "var(--space-3)";
    infoP.textContent = `${productName || barcode} ürünü için tespit ettiğiniz eksik veya hatalı bileşeni belirtiniz. Moderatör onayladığında hesabınıza 20 İnci yüklenecektir.`;
    form.appendChild(infoP);

    const descInput = document.createElement("textarea");
    descInput.className = "form-textarea";
    descInput.style.minHeight = "80px";
    descInput.style.marginBottom = "var(--space-3)";
    descInput.placeholder = "Örnek: İçerik listesinde Parfüm yazmıyor ama kutunun arkasında Fragrance var...";
    form.appendChild(descInput);

    const corrInput = document.createElement("input");
    corrInput.className = "form-input";
    corrInput.style.marginBottom = "var(--space-3)";
    corrInput.placeholder = "Doğru INCI ismi veya öneriniz (İsteğe bağlı)";
    form.appendChild(corrInput);

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary";
    submitBtn.style.width = "100%";
    submitBtn.innerHTML = "🚀 Bildirimi Gönder (+20 İnci)";
    form.appendChild(submitBtn);

    modalBody.appendChild(form);
    modalBox.appendChild(modalBody);
    modalBackdrop.appendChild(modalBox);
    document.body.appendChild(modalBackdrop);
  }

  /**
   * Serbest metin analizi
   */
  async processRawIngredients(rawText) {
    this.resultsContainer.innerHTML = "";
    this.resultsContainer.appendChild(CardFactory.createSkeletonCard());

    try {
      const result = await scanService.checkTextCompatibility(rawText);
      this.resultsContainer.innerHTML = "";
      this.resultsContainer.appendChild(CardFactory.createCompatibilityCard({
        productName: "Özel İçerik Listesi Analizi",
        score: result.compatibilityScore || 80,
        matchedAllergens: result.matchedAllergens || [],
        flaggedIngredients: result.flaggedIngredients || [],
        beneficialIngredients: result.beneficialIngredients || [],
        aiComment: result.analysisComment || "Cilt profilinize göre bileşenlerin güvenlik oranları analiz edilmiştir."
      }));
    } catch (err) {
      this.resultsContainer.innerHTML = "";
      this.resultsContainer.appendChild(
        CardFactory.createErrorCard(err.message, () => this.processRawIngredients(rawText))
      );
    }
  }

  destroy() {
    // Sayfadan çıkılınca kamerayı mutlaka kapat
    this.closeCameraModal();
  }
}
