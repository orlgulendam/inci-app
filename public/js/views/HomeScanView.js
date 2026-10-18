// public/js/views/HomeScanView.js - Ana Sayfa ve Ürün Tarama Görünümü (SRP & Strategy)
// Gerekçe: 3 tarama yöntemini (Canlı Kamera, Fotoğraf Çekme/Yükleme, Manuel Giriş) tek bir arayüzde birleştirmek ve sonuçları CardFactory ile sunmak için.
import { scannerService } from "../scanner/ScannerService.js";
import { scanService } from "../services/scanService.js";
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
    modalFooter.textContent = "Lütfen ürün barkodunu kutucuğun içine hizalayınız. Kamera arka kamera olarak açılır.";
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
          // Barkod bulunamadıysa fotoğraftan içerik aramaya veya serbest metne yönlendir
          toast.info("Görselde barkod okunamadı. Lütfen barkod numarasını manuel giriniz veya içerik metnini yapıştırınız.");
        }
      };
    } catch (err) {
      toast.error(err.message);
    }
  }

  /**
   * Barkod analizi gerçekleştirir
   */
  async processBarcode(barcode) {
    this.resultsContainer.innerHTML = "";
    this.resultsContainer.appendChild(CardFactory.createSkeletonCard());

    try {
      const result = await scanService.checkBarcodeCompatibility(barcode);
      this.resultsContainer.innerHTML = "";
      this.resultsContainer.appendChild(CardFactory.createCompatibilityCard({
        barcode,
        productName: result.product?.name,
        brand: result.product?.brand,
        score: result.compatibilityScore || 85,
        matchedAllergens: result.matchedAllergens || [],
        flaggedIngredients: result.flaggedIngredients || [],
        beneficialIngredients: result.beneficialIngredients || [],
        aiComment: result.analysisComment || result.summary
      }));
    } catch (err) {
      this.resultsContainer.innerHTML = "";
      this.resultsContainer.appendChild(
        CardFactory.createErrorCard(
          `'${barcode}' barkoduna ait ürün bulunamadı veya analiz edilemedi: ${err.message}`,
          () => this.processBarcode(barcode)
        )
      );
    }
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
