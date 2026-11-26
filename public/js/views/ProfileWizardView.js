// public/js/views/ProfileWizardView.js - Cilt Profili Sihirbazı (Wizard Pattern & SRP)
import { profileService } from "../services/profileService.js";
import { routineService } from "../services/routineService.js";
import { store } from "../state/store.js";
import { toast } from "../components/Toast.js";
import { OysterChestModal } from "../components/OysterChestModal.js";
import { ShareCardModal } from "../components/ShareCardModal.js";

// Backend cilt tipini İngilizce domain sabiti olarak saklar ("dry"), arayüz çipleri
// ise Türkçe kimlik kullanır ("kuru"). Ters eşleme olmadan kaydedilmiş cilt tipi
// profile dönüldüğünde hiçbir çip seçili görünmüyordu.
const BACKEND_TO_UI_SKIN_TYPE = {
  dry: "kuru",
  oily: "yagli",
  combination: "karma",
  sensitive: "hassas",
  normal: "normal"
};

/**
 * Backend'den gelen dermatolog notlarını metin kutusunda gösterilebilir düz metne çevirir.
 * Backend [{ note, date }] dizisi saklıyor; dizi doğrudan metin kutusuna basıldığında
 * "[object Object]" görünüyor ve kullanıcı alana dokunduğu anda gerçek not bu metinle
 * kalıcı olarak eziliyordu.
 */
function notlariMetneCevir(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((n) => (typeof n === "string" ? n : (n && n.note) || ""))
    .filter((n) => String(n).trim().length > 0)
    .join("\n");
}

/**
 * Büyük/küçük harf duyarsız liste karşılaştırması.
 * Backend alerjenleri BÜYÜK HARFE ("PARABENS"), hedefleri küçük harfe
 * ("nemlendirme") çeviriyor; arayüz çipleri ise özgün yazımı kullanıyor
 * ("Parabens", "Nemlendirme"). Birebir karşılaştırma yüzünden kaydedilmiş
 * seçimler profile dönüldüğünde seçili görünmüyordu.
 */
function listedeVarMi(list, value) {
  const hedef = String(value).toLocaleLowerCase("tr");
  return (list || []).some((item) => String(item).toLocaleLowerCase("tr") === hedef);
}

function listedenCikar(list, value) {
  const hedef = String(value).toLocaleLowerCase("tr");
  return (list || []).filter((item) => String(item).toLocaleLowerCase("tr") !== hedef);
}

export class ProfileWizardView {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.currentStep = 1;
    this.totalSteps = 4;
    this.activeTab = "profile"; // "profile" | "routine" | "vanity"
    this.userPoints = 0;
    this.streakCount = 0;
    this.lastScanDate = null;
    this.profileCompletedBonusClaimed = false;

    this.profileData = {
      firstName: "",
      lastName: "",
      skinType: "karma",
      conditions: [],
      allergicIngredients: [],
      hasAllergy: false,
      frequentlyUsedProducts: [],
      routineMedications: [],
      dermatologistNotes: "",
      targetedBenefits: []
    };
  }

  async loadInitialData() {
    try {
      const res = await profileService.getProfile();
      if (res) {
        this.userPoints = res.points || 0;
        this.streakCount = res.streakCount || 0;
        this.lastScanDate = res.lastScanDate || null;
        this.profileCompletedBonusClaimed = res.profileCompletedBonusClaimed || false;
        this.profileData.firstName = res.firstName || "";
        this.profileData.lastName = res.lastName || "";
        const p = res.skinProfile || {};
        this.profileData.skinType = BACKEND_TO_UI_SKIN_TYPE[p.skinType] || p.skinType || "karma";
        this.profileData.conditions = Array.isArray(p.conditions) ? [...p.conditions] : [];
        this.profileData.allergicIngredients = Array.isArray(p.allergicIngredients) ? [...p.allergicIngredients] : [];
        this.profileData.hasAllergy = this.profileData.allergicIngredients.length > 0;
        this.profileData.frequentlyUsedProducts = Array.isArray(p.frequentlyUsedProducts) ? [...p.frequentlyUsedProducts] : [];
        this.profileData.routineMedications = Array.isArray(p.routineMedications) ? [...p.routineMedications] : [];
        this.profileData.dermatologistNotes = notlariMetneCevir(p.dermatologistNotes);
        this.profileData.targetedBenefits = Array.isArray(p.targetedBenefits) ? [...p.targetedBenefits] : [];
      }
    } catch (err) {
      console.warn("Could not load skin profile:", err.message);
    }
    this.render();
  }

  calculateCompletion() {
    let score = 0;
    if (this.profileData.firstName) score += 15;
    if (this.profileData.skinType) score += 25;
    if (this.profileData.targetedBenefits.length > 0) score += 20;
    if (this.profileData.allergicIngredients.length > 0 || !this.profileData.hasAllergy) score += 15;
    if (this.profileData.frequentlyUsedProducts.length > 0) score += 15;
    if (this.profileData.dermatologistNotes || this.profileData.routineMedications.length > 0) score += 10;
    return Math.min(100, score);
  }

  render() {
    this.container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "680px";
    card.style.margin = "var(--space-4) auto";

    // Header & Tamamlanma Yüzdesi
    const header = document.createElement("div");
    header.className = "card-header";

    const titleBox = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = "Kişiselleştirilmiş Cilt Profili";
    titleBox.appendChild(title);

    const completion = this.calculateCompletion();
    const percentSpan = document.createElement("span");
    percentSpan.className = "badge badge-info";
    percentSpan.textContent = `Tamamlanma: %${completion}`;
    titleBox.appendChild(percentSpan);
    header.appendChild(titleBox);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";

    // Topluluk Puan & Rozet Göstergesi (Gamification Banner)
    const points = this.userPoints || 0;
    const streak = this.streakCount || 0;
    let badgeTitle = "Cilt Kaşifi 🥉";
    let badgeColor = "#b45309";

    if (points >= 500) {
      badgeTitle = "Dermokozmetik Gurusu 🥇";
      badgeColor = "#b8325e";
    } else if (points >= 100) {
      badgeTitle = "İçerik Dedektifi 🥈";
      badgeColor = "#4b5563";
    }

    // 7 Günlük İnci Dizilimi Hesapla
    const cycleDay = (streak % 7 === 0 && streak > 0) ? 7 : (streak % 7);
    let pearlsHtml = "";
    for (let i = 1; i <= 7; i++) {
      if (i <= cycleDay) {
        pearlsHtml += `<span style="font-size: 1.35rem; margin: 0 3px; display: inline-block; filter: drop-shadow(0 2px 4px rgba(184, 50, 94, 0.3));" title="${i}. Gün İncisi Toplandı">🦪</span>`;
      } else {
        pearlsHtml += `<span style="font-size: 1.1rem; opacity: 0.35; margin: 0 3px; display: inline-block;" title="${i}. Gün">⚪</span>`;
      }
    }

    const gamificationBanner = document.createElement("div");
    gamificationBanner.style.background = "linear-gradient(135deg, var(--color-primary-50), #fff)";
    gamificationBanner.style.border = "1px solid var(--color-primary-200)";
    gamificationBanner.style.borderRadius = "var(--radius-lg)";
    gamificationBanner.style.padding = "var(--space-3) var(--space-4)";
    gamificationBanner.style.marginBottom = "var(--space-4)";
    gamificationBanner.style.boxShadow = "var(--shadow-sm)";

    gamificationBanner.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
        <div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600; text-transform: uppercase;">Topluluk Rütbeniz</div>
          <div style="font-size: var(--font-size-md); font-weight: 800; color: ${badgeColor};">${badgeTitle}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;">TOPLANAN İNCİLER</div>
          <div style="font-size: var(--font-size-lg); font-weight: 800; color: var(--color-primary-800);">🦪 ${points} İnci</div>
        </div>
      </div>

      <!-- Günlük İnci Serisi (Streak) -->
      <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px dashed var(--color-primary-200);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
          <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-primary-800);">
            🔥 Günlük İnci Serisi (Streak): ${streak} Gün
          </span>
          <span style="font-size: 11px; font-weight: 600; color: var(--color-primary-600); background: var(--color-primary-100); padding: 2px 8px; border-radius: 12px;">
            Her Gün 1 Tarama = +5 İnci
          </span>
        </div>
        <div style="display: flex; align-items: center; padding: 4px 0;">
          ${pearlsHtml}
        </div>
        <p style="font-size: 11px; color: var(--color-text-muted); margin: 6px 0 0 0;">
          ⚠️ Her gün en az 1 ürün taratmadığınızda inci seriniz bozulur ve sıfırlanır!
        </p>
      </div>

      <!-- %100 Profil Tamamlama Bonusu -->
      <div style="margin-top: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--color-primary-100); font-size: 11px;">
        ${
          this.profileCompletedBonusClaimed
            ? '<span style="color: #059669; font-weight: 600;">🎉 Cilt profilinizi %100 tamamladınız ve +30 İnci ödülünüzü aldınız!</span>'
            : '<span style="color: var(--color-primary-700); font-weight: 600;">💡 Cilt profilinizi %100 doldurarak anında <strong>+30 İnci</strong> kazanabilirsiniz!</span>'
        }
      </div>

      <!-- İstiridye Sandığı & Story Paylaşım Butonları -->
      <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px dashed var(--color-primary-200); display: flex; gap: 8px; flex-wrap: wrap;">
        ${
          streak >= 7
            ? '<button id="btnOpenChest" class="btn btn-primary btn-sm" style="font-weight: 700; flex: 1;">🦪 7 Günlük İstiridye Sandığını Aç!</button>'
            : `<button id="btnOpenChestLocked" class="btn btn-outline btn-sm" style="flex: 1; opacity: 0.7;" disabled>🦪 İstiridye Sandığı (${streak}/7 Gün)</button>`
        }
        <button id="btnShareStory" class="btn btn-secondary btn-sm" style="font-weight: 700; flex: 1;">
          ✨ Story Kartı Paylaş
        </button>
      </div>
    `;
    body.appendChild(gamificationBanner);

    // Banner İçi Buton Olayları
    const openChestBtn = gamificationBanner.querySelector("#btnOpenChest");
    if (openChestBtn) {
      openChestBtn.onclick = () => {
        new OysterChestModal(() => this.loadInitialData()).show(streak);
      };
    }

    const shareStoryBtn = gamificationBanner.querySelector("#btnShareStory");
    if (shareStoryBtn) {
      shareStoryBtn.onclick = () => {
        const name = this.profileData.firstName ? `${this.profileData.firstName} ${this.profileData.lastName || ""}` : "İnci Kaşifi";
        new ShareCardModal().show({
          userName: name.trim(),
          skinType: this.profileData.skinType || "Karma Cilt",
          streakCount: this.streakCount,
          points: this.userPoints,
          safetyScore: 92,
          freshCount: 4,
          expiredCount: 0
        });
      };
    }

    // Ana Sekme Menüsü (Cilt Profilim / Cilt Rutinim / Dijital Dolabım)
    const tabsContainer = document.createElement("div");
    tabsContainer.style.display = "flex";
    tabsContainer.style.gap = "8px";
    tabsContainer.style.marginBottom = "var(--space-4)";
    tabsContainer.style.borderBottom = "2px solid var(--color-border)";
    tabsContainer.style.paddingBottom = "8px";

    const tabProfileBtn = document.createElement("button");
    tabProfileBtn.className = `btn btn-sm ${this.activeTab === "profile" ? "btn-primary" : "btn-outline"}`;
    tabProfileBtn.textContent = "📋 Cilt Profilim";
    tabProfileBtn.onclick = () => { this.activeTab = "profile"; this.render(); };
    tabsContainer.appendChild(tabProfileBtn);

    const tabRoutineBtn = document.createElement("button");
    tabRoutineBtn.className = `btn btn-sm ${this.activeTab === "routine" ? "btn-primary" : "btn-outline"}`;
    tabRoutineBtn.textContent = "☀️🌙 Cilt Rutinim";
    tabRoutineBtn.onclick = () => { this.activeTab = "routine"; this.render(); };
    tabsContainer.appendChild(tabRoutineBtn);

    const tabVanityBtn = document.createElement("button");
    tabVanityBtn.className = `btn btn-sm ${this.activeTab === "vanity" ? "btn-primary" : "btn-outline"}`;
    tabVanityBtn.textContent = "🧴 Dijital Dolabım (SKT)";
    tabVanityBtn.onclick = () => { this.activeTab = "vanity"; this.render(); };
    tabsContainer.appendChild(tabVanityBtn);

    body.appendChild(tabsContainer);

    if (this.activeTab === "routine") {
      this.renderRoutineSection(body);
      card.appendChild(body);
      this.container.appendChild(card);
      return;
    }

    if (this.activeTab === "vanity") {
      this.renderVanitySection(body);
      card.appendChild(body);
      this.container.appendChild(card);
      return;
    }

    // Stepper Göstergesi (Yalnızca Profil Sekmesinde)
    const stepper = document.createElement("div");
    stepper.className = "stepper";
    for (let i = 1; i <= this.totalSteps; i++) {
      const stepElem = document.createElement("div");
      stepElem.className = `stepper-step ${i === this.currentStep ? "active" : i < this.currentStep ? "completed" : ""}`;
      stepElem.textContent = i < this.currentStep ? "✓" : String(i);
      stepper.appendChild(stepElem);
    }
    body.appendChild(stepper);

    // Adım İçeriği
    if (this.currentStep === 1) body.appendChild(this.renderStep1());
    else if (this.currentStep === 2) body.appendChild(this.renderStep2());
    else if (this.currentStep === 3) body.appendChild(this.renderStep3());
    else if (this.currentStep === 4) body.appendChild(this.renderStep4());

    card.appendChild(body);

    // Footer Navigasyon Butonları
    const footer = document.createElement("div");
    footer.className = "card-footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";

    if (this.currentStep > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.className = "btn btn-outline";
      prevBtn.textContent = "← Önceki Adım";
      prevBtn.onclick = () => { this.currentStep--; this.render(); };
      footer.appendChild(prevBtn);
    } else {
      footer.appendChild(document.createElement("div"));
    }

    if (this.currentStep < this.totalSteps) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "btn btn-primary";
      nextBtn.textContent = "Sonraki Adım →";
      nextBtn.onclick = () => { this.currentStep++; this.render(); };
      footer.appendChild(nextBtn);
    } else {
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-primary";
      saveBtn.textContent = "Profili Kaydet ve Tamamla ✓";
      saveBtn.onclick = () => this.saveProfile();
      footer.appendChild(saveBtn);
    }

    card.appendChild(footer);
    this.container.appendChild(card);

    // Apple App Store Guideline 5.1.1 Uyumlu Hesap Silme Bölümü
    const dangerCard = document.createElement("div");
    dangerCard.className = "card";
    dangerCard.style.maxWidth = "680px";
    dangerCard.style.margin = "var(--space-3) auto";
    dangerCard.style.border = "1px solid var(--color-danger-border)";
    dangerCard.style.background = "#fff8f8";

    const dangerBody = document.createElement("div");
    dangerBody.className = "card-body";
    dangerBody.style.display = "flex";
    dangerBody.style.justifyContent = "space-between";
    dangerBody.style.alignItems = "center";
    dangerBody.style.flexWrap = "wrap";
    dangerBody.style.gap = "var(--space-2)";

    dangerBody.innerHTML = `
      <div>
        <strong style="color:var(--color-danger); font-size:var(--font-size-sm);">Hesap ve Kişisel Veri Yönetimi</strong>
        <p style="font-size:var(--font-size-xs); color:var(--color-text-muted); margin:0;">
          KVKK ve Apple App Store gereği tüm cilt verilerinizi ve hesabınızı istediğiniz an silebilirsiniz.
        </p>
      </div>
    `;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-danger";
    deleteBtn.textContent = "Hesabımı ve Verilerimi Sil";
    deleteBtn.onclick = async () => {
      const confirmed = window.confirm("Hesabınızı ve kayıtlı tüm cilt profili verilerinizi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.");
      if (confirmed) {
        try {
          deleteBtn.disabled = true;
          deleteBtn.textContent = "Siliniyor...";
          await profileService.deleteAccount();
          toast.success("Hesabınız ve tüm verileriniz başarıyla silindi.");
          this.onNavigate("home");
        } catch (err) {
          toast.error(err.message);
          deleteBtn.disabled = false;
          deleteBtn.textContent = "Hesabımı ve Verilerimi Sil";
        }
      }
    };
    dangerBody.appendChild(deleteBtn);
    dangerCard.appendChild(dangerBody);
    this.container.appendChild(dangerCard);
  }


  // ADIM 1: Ad, Soyad ve Cilt Tipi
  renderStep1() {
    const box = document.createElement("div");

    const nameGrid = document.createElement("div");
    nameGrid.style.display = "grid";
    nameGrid.style.gridTemplateColumns = "1fr 1fr";
    nameGrid.style.gap = "var(--space-3)";
    nameGrid.innerHTML = `
      <div class="form-group">
        <label class="form-label">Adınız</label>
        <input type="text" id="profFirst" class="form-input" value="${this.profileData.firstName || ""}" />
      </div>
      <div class="form-group">
        <label class="form-label">Soyadınız</label>
        <input type="text" id="profLast" class="form-input" value="${this.profileData.lastName || ""}" />
      </div>
    `;
    nameGrid.querySelector("#profFirst").oninput = (e) => this.profileData.firstName = e.target.value;
    nameGrid.querySelector("#profLast").oninput = (e) => this.profileData.lastName = e.target.value;
    box.appendChild(nameGrid);

    const skinTypeGroup = document.createElement("div");
    skinTypeGroup.className = "form-group";
    skinTypeGroup.innerHTML = `<label class="form-label">Cilt Tipinizi Seçin</label>`;

    const skinTypes = [
      { id: "kuru", label: "Kuru Cilt", desc: "Gergin, pul pul dökülmeye meyilli" },
      { id: "yagli", label: "Yağlı Cilt", desc: "Parlama, geniş gözenekler" },
      { id: "karma", label: "Karma Cilt", desc: "T bölgesi yağlı, yanaklar kuru/normal" },
      { id: "normal", label: "Normal Cilt", desc: "Dengeli nem ve sebum oranı" },
      { id: "hassas", label: "Hassas Cilt", desc: "Kızarıklık, kaşıntı ve batmaya meyilli" }
    ];

    const chipGroup = document.createElement("div");
    chipGroup.className = "chip-group";
    for (const t of skinTypes) {
      const chip = document.createElement("div");
      chip.className = `chip ${this.profileData.skinType === t.id ? "active" : ""}`;
      chip.textContent = `${t.label}`;
      chip.title = t.desc;
      chip.onclick = () => {
        this.profileData.skinType = t.id;
        this.render();
      };
      chipGroup.appendChild(chip);
    }
    skinTypeGroup.appendChild(chipGroup);
    box.appendChild(skinTypeGroup);

    return box;
  }

  // ADIM 2: Alerjenler ve Hassasiyetler
  renderStep2() {
    const box = document.createElement("div");

    // Cilt durumları (conditions): SkinCompatibilityEngine bu alanı okuyor ama
    // arayüzde seçilemediği için her kullanıcıda boş kalıyor ve hassasiyet
    // kuralları hiç çalışmıyordu.
    const conditionsGroup = document.createElement("div");
    conditionsGroup.className = "form-group";
    conditionsGroup.innerHTML = `<label class="form-label">Cilt Durumlarınız (Varsa Dokunarak Seçin)</label>`;

    const skinConditions = [
      { id: "eczema", label: "Egzama" },
      { id: "rosacea", label: "Rozase (Gül Hastalığı)" },
      { id: "fungal_acne", label: "Mantar Akne (Malassezia)" },
      { id: "fragrance_sensitive", label: "Koku Hassasiyeti" },
      { id: "comedogenic_prone", label: "Komedon / Siyah Nokta Eğilimi" },
      { id: "acne", label: "Akne" },
      { id: "hyperpigmentation", label: "Leke / Hiperpigmentasyon" }
    ];

    const conditionChips = document.createElement("div");
    conditionChips.className = "chip-group";
    for (const c of skinConditions) {
      const isSelected = this.profileData.conditions.includes(c.id);
      const chip = document.createElement("div");
      chip.className = `chip ${isSelected ? "active" : ""}`;
      chip.textContent = c.label;
      chip.onclick = () => {
        if (isSelected) {
          this.profileData.conditions = this.profileData.conditions.filter(x => x !== c.id);
        } else {
          this.profileData.conditions.push(c.id);
        }
        this.render();
      };
      conditionChips.appendChild(chip);
    }
    conditionsGroup.appendChild(conditionChips);
    box.appendChild(conditionsGroup);

    const allergyRadioGroup = document.createElement("div");
    allergyRadioGroup.className = "form-group";
    allergyRadioGroup.innerHTML = `
      <label class="form-label">Bilinen bir kozmetik alerjiniz veya hassasiyetiniz var mı?</label>
      <div style="display:flex; gap:var(--space-4); margin-top:var(--space-2);">
        <label><input type="radio" name="hasAllergy" value="no" ${!this.profileData.hasAllergy ? "checked" : ""}> Hayır, yok</label>
        <label><input type="radio" name="hasAllergy" value="yes" ${this.profileData.hasAllergy ? "checked" : ""}> Evet, var</label>
      </div>
    `;
    allergyRadioGroup.querySelectorAll("input").forEach(r => {
      r.onchange = (e) => {
        this.profileData.hasAllergy = e.target.value === "yes";
        this.render();
      };
    });
    box.appendChild(allergyRadioGroup);

    if (this.profileData.hasAllergy) {
      const commonAllergens = ["Fragrance (Parfüm)", "Parabens", "Alcohol Denat", "Essential Oils", "Sulfates (SLS/SLES)", "Lanolin"];
      const commonGroup = document.createElement("div");
      commonGroup.className = "form-group";
      commonGroup.innerHTML = `<label class="form-label">Sık Karşılaşılan Alerjenler (Dokunarak Seçin)</label>`;

      const chips = document.createElement("div");
      chips.className = "chip-group";
      for (const item of commonAllergens) {
        const isSelected = listedeVarMi(this.profileData.allergicIngredients, item);
        const chip = document.createElement("div");
        chip.className = `chip ${isSelected ? "active" : ""}`;
        chip.textContent = item;
        chip.onclick = () => {
          if (isSelected) {
            this.profileData.allergicIngredients = listedenCikar(this.profileData.allergicIngredients, item);
          } else {
            this.profileData.allergicIngredients.push(item);
          }
          this.render();
        };
        chips.appendChild(chip);
      }
      commonGroup.appendChild(chips);
      box.appendChild(commonGroup);

      // Özel Alerjen Ekleme
      const customGroup = document.createElement("div");
      customGroup.className = "form-group";
      customGroup.innerHTML = `
        <label class="form-label">Diğer Alerjenik Bileşenler (Virgülle ayırarak yazabilirsiniz)</label>
        <input type="text" id="customAllergens" class="form-input" placeholder="Örn: Salicylic Acid, Tea Tree Oil" />
      `;
      const input = customGroup.querySelector("#customAllergens");
      input.onchange = (e) => {
        const items = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
        for (const it of items) {
          if (!listedeVarMi(this.profileData.allergicIngredients, it)) {
            this.profileData.allergicIngredients.push(it);
          }
        }
        this.render();
      };
      box.appendChild(customGroup);
    }

    return box;
  }

  // ADIM 3: Düzenli Kullanılan Ürünler & Rutindeki İlaçlar
  renderStep3() {
    const box = document.createElement("div");

    // 1. Genelde kullandığı ürünler listesi (Ekle/Sil)
    box.appendChild(this.renderListManager(
      "Genelde Kullandığınız Ürünler",
      "Örn: CeraVe Hydrating Cleanser, La Roche Posay Anthelios SPF50",
      this.profileData.frequentlyUsedProducts,
      (newList) => this.profileData.frequentlyUsedProducts = newList
    ));

    // 2. Rutinde kullandığı ilaç ve medikal ürünler (Ekle/Sil)
    box.appendChild(this.renderListManager(
      "Cilt Bakım Rutininde Kullandığınız İlaçlar / Reçeteli Kremler",
      "Örn: Roaccutane / İzotretinoin, Nadixa Krem, Azelaik Asit %15",
      this.profileData.routineMedications,
      (newList) => this.profileData.routineMedications = newList
    ));

    return box;
  }

  // ADIM 4: Hedeflenen Etkiler & Dermatolog Tavsiyeleri
  renderStep4() {
    const box = document.createElement("div");

    const benefits = [
      "Nemlendirme", "Akne & Gözenek Karşıtı", "Leke Giderici & Aydınlatıcı",
      "Anti-Aging / Kırışıklık", "Yatıştırıcı / Bariyer Onarıcı", "Güneş Koruması (SPF)"
    ];

    const benefitGroup = document.createElement("div");
    benefitGroup.className = "form-group";
    benefitGroup.innerHTML = `<label class="form-label">Ürünlerde En Çok Dikkat Ettiğiniz Etkiler (Çoklu Seçim)</label>`;

    const chips = document.createElement("div");
    chips.className = "chip-group";
    for (const b of benefits) {
      const isSelected = listedeVarMi(this.profileData.targetedBenefits, b);
      const chip = document.createElement("div");
      chip.className = `chip ${isSelected ? "active" : ""}`;
      chip.textContent = b;
      chip.onclick = () => {
        if (isSelected) {
          this.profileData.targetedBenefits = listedenCikar(this.profileData.targetedBenefits, b);
        } else {
          this.profileData.targetedBenefits.push(b);
        }
        this.render();
      };
      chips.appendChild(chip);
    }
    benefitGroup.appendChild(chips);
    box.appendChild(benefitGroup);

    // Dermatolog Tavsiyeleri Serbest Not Alanı
    const dermGroup = document.createElement("div");
    dermGroup.className = "form-group";
    dermGroup.innerHTML = `
      <label class="form-label">Dermatoloğunuzun Verdiği Tavsiyeler & Notlar</label>
      <textarea id="dermNotes" class="form-textarea" placeholder="Örn: 15 Ekim 2026 muayenesi: Cilt bariyeri zayıf, kimyasal peelinglerden kaçınılmalı, seramid bazlı ürünler tercih edilmeli.">${this.profileData.dermatologistNotes || ""}</textarea>
      <span class="form-hint">KVKK Güvencesi: Bu notlar hiçbir zaman yapay zeka sağlayıcılarına veya dış servislere gönderilmez; yalnızca sizin profilinizde güvenle saklanır.</span>
    `;
    dermGroup.querySelector("#dermNotes").oninput = (e) => {
      this.profileData.dermatologistNotes = e.target.value;
    };
    box.appendChild(dermGroup);

    return box;
  }

  renderListManager(title, placeholder, list, onChange) {
    const container = document.createElement("div");
    container.className = "form-group";

    const label = document.createElement("label");
    label.className = "form-label";
    label.textContent = title;
    container.appendChild(label);

    const inputRow = document.createElement("div");
    inputRow.style.display = "flex";
    inputRow.style.gap = "var(--space-2)";

    const input = document.createElement("input");
    input.className = "form-input";
    input.placeholder = placeholder;
    inputRow.appendChild(input);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-secondary";
    addBtn.textContent = "+ Ekle";
    addBtn.onclick = () => {
      const val = input.value.trim();
      if (val && !list.includes(val)) {
        list.push(val);
        onChange([...list]);
        this.render();
      }
    };
    inputRow.appendChild(addBtn);
    container.appendChild(inputRow);

    // Mevcut Liste Elemanları
    if (list.length > 0) {
      const chipList = document.createElement("div");
      chipList.className = "chip-group";
      chipList.style.marginTop = "var(--space-2)";
      list.forEach((item, index) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.style.display = "inline-flex";
        chip.style.alignItems = "center";
        chip.style.gap = "var(--space-2)";
        chip.textContent = item;

        const del = document.createElement("span");
        del.textContent = "✕";
        del.style.cursor = "pointer";
        del.style.color = "var(--color-danger)";
        del.onclick = (e) => {
          e.stopPropagation();
          list.splice(index, 1);
          onChange([...list]);
          this.render();
        };
        chip.appendChild(del);
        chipList.appendChild(chip);
      });
      container.appendChild(chipList);
    }

    return container;
  }

  async saveProfile() {
    try {
      await profileService.updateProfile(this.profileData);
      toast.success("Cilt profiliniz başarıyla kaydedildi!");
      this.onNavigate("home");
    } catch (err) {
      toast.error(err.message);
    }
  }

  // ==========================================
  // CİLT RUTİNİ BÖLÜMÜ (Sabah & Akşam)
  // ==========================================
  async renderRoutineSection(container) {
    const routineBox = document.createElement("div");
    routineBox.innerHTML = `<div style="text-align: center; padding: 20px;"><div class="skeleton skeleton-block"></div><p>Rutinleriniz yükleniyor...</p></div>`;
    container.appendChild(routineBox);

    try {
      const res = await routineService.getRoutine();
      const routineData = res.data?.routine || { morning: [], evening: [] };
      const todayStatus = res.data?.todayStatus || { morningCompleted: false, eveningCompleted: false };

      routineBox.innerHTML = "";

      // Bilgi ve Teşvik Bannerı
      const infoCard = document.createElement("div");
      infoCard.style.cssText = "background: #FFF0F4; border: 1px solid var(--color-primary-200); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-4);";
      infoCard.innerHTML = `
        <div style="font-weight: 700; color: var(--color-primary-dark); font-size: 14px; margin-bottom: 4px;">
          ✨ Günlük Cilt Rutini Disiplini
        </div>
        <p style="font-size: 12px; color: var(--color-text-muted); margin: 0; line-height: 1.4;">
          Sabah Rutinini tamamla: <strong>+3 İnci</strong> | Akşam Rutinini tamamla: <strong>+3 İnci</strong><br/>
          Her ikisini de bitir: <strong>+2 Gün Sonu Bonusu</strong> (Günde toplam +8 İnci!)
        </p>
      `;
      routineBox.appendChild(infoCard);

      // --- 1. SABAH RUTİNİ (Gündüz) ---
      const morningCard = document.createElement("div");
      morningCard.className = "card";
      morningCard.style.cssText = "border: 1px solid #FFE0B2; background: #FFFDF9; margin-bottom: var(--space-4); padding: var(--space-3);";

      const mCompleted = todayStatus.morningCompleted;
      morningCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
          <h3 style="margin: 0; font-size: 16px; color: #E65100;">☀️ Sabah Rutini</h3>
          <span class="badge ${mCompleted ? 'badge-success' : 'badge-warning'}">
            ${mCompleted ? '✅ Bugün Tamamlandı' : '⏳ Yapılmayı Bekliyor'}
          </span>
        </div>
        <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: var(--space-3);">
          Gündüzün zararlı UV ışınlarına ve serbest radikallerine karşı antioksidan koruma adımları.
        </div>
        <ul style="list-style: none; padding: 0; margin: 0 0 var(--space-3) 0; font-size: 13px;">
          <li style="padding: 6px 0; border-bottom: 1px dashed #FFE0B2;">💧 1. Nazik Su Bazlı Temizleyici</li>
          <li style="padding: 6px 0; border-bottom: 1px dashed #FFE0B2;">🍊 2. Saf C Vitamini / Antioksidan Serum</li>
          <li style="padding: 6px 0; border-bottom: 1px dashed #FFE0B2;">🧴 3. Hafif Yapılı Nemlendirici</li>
          <li style="padding: 6px 0;">🛡️ 4. Geniş Spektrumlu Güneş Kremi (SPF 50+)</li>
        </ul>
        <button id="completeMorningBtn" class="btn ${mCompleted ? 'btn-outline' : 'btn-primary'}" style="width: 100%; font-weight: 700;" ${mCompleted ? 'disabled' : ''}>
          ${mCompleted ? '✅ Bugünkü Sabah Rutini Tamamlandı (+3 İnci Alındı)' : '☀️ Sabah Rutinimi Tamamladım (+3 İnci Kazan)'}
        </button>
      `;
      routineBox.appendChild(morningCard);

      morningCard.querySelector("#completeMorningBtn").onclick = async () => {
        try {
          const result = await routineService.completeRoutineStep("morning");
          const r = result.data;
          toast.success(`☀️ Sabah Rutini Tamamlandı! +${r.pointsAwarded} İnci kazandınız!`);
          this.userPoints = r.points;
          this.render();
        } catch (err) {
          toast.error(err.message || "Rutin kaydedilirken hata oluştu.");
        }
      };

      // --- 2. AKŞAM RUTİNİ (Gece) ---
      const eveningCard = document.createElement("div");
      eveningCard.className = "card";
      eveningCard.style.cssText = "border: 1px solid #D1C4E9; background: #FAF8FE; margin-bottom: var(--space-4); padding: var(--space-3);";

      const eCompleted = todayStatus.eveningCompleted;
      eveningCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
          <h3 style="margin: 0; font-size: 16px; color: #4A148C;">🌙 Akşam Rutini</h3>
          <span class="badge ${eCompleted ? 'badge-success' : 'badge-warning'}">
            ${eCompleted ? '✅ Bugün Tamamlandı' : '⏳ Yapılmayı Bekliyor'}
          </span>
        </div>
        <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: var(--space-3);">
          Gün boyu biriken kiri arındırma, hücresel yenilenme ve bariyer onarımı adımları.
        </div>
        <ul style="list-style: none; padding: 0; margin: 0 0 var(--space-3) 0; font-size: 13px;">
          <li style="padding: 6px 0; border-bottom: 1px dashed #D1C4E9;">🫧 1. Çift Aşamalı Temizlik (Yağ + Su Bazlı)</li>
          <li style="padding: 6px 0; border-bottom: 1px dashed #D1C4E9;">✨ 2. Aktif Bakım Serumu (Retinol veya Peeling Asidi)</li>
          <li style="padding: 6px 0;">🌙 3. Seramid ve Peptit Destekli Onarıcı Gece Kremi</li>
        </ul>
        <button id="completeEveningBtn" class="btn ${eCompleted ? 'btn-outline' : 'btn-primary'}" style="width: 100%; font-weight: 700;" ${eCompleted ? 'disabled' : ''}>
          ${eCompleted ? '✅ Bugünkü Akşam Rutini Tamamlandı (+3 İnci Alındı)' : '🌙 Akşam Rutinimi Tamamladım (+3 İnci Kazan)'}
        </button>
      `;
      routineBox.appendChild(eveningCard);

      eveningCard.querySelector("#completeEveningBtn").onclick = async () => {
        try {
          const result = await routineService.completeRoutineStep("evening");
          const r = result.data;
          const bonusMsg = r.bothCompletedBonus ? " 🌟 Hem sabah hem akşam tamamlandığı için +2 ekstra bonus eklendi!" : "";
          toast.success(`🌙 Akşam Rutini Tamamlandı! +${r.pointsAwarded} İnci kazandınız!${bonusMsg}`);
          this.userPoints = r.points;
          this.render();
        } catch (err) {
          toast.error(err.message || "Rutin kaydedilirken hata oluştu.");
        }
      };

      if (mCompleted && eCompleted) {
        const fullDayCelebration = document.createElement("div");
        fullDayCelebration.style.cssText = "background: linear-gradient(135deg, #FFD54F, #FFCA28); color: #3E2723; padding: var(--space-3); border-radius: var(--radius-md); text-align: center; font-weight: 700; font-size: 13px; box-shadow: 0 4px 12px rgba(255,193,7,0.3);";
        fullDayCelebration.innerHTML = "👑 Günün Yıldızı Sensin! Bugün hem Sabah hem Akşam bakımını eksiksiz yaparak cildine en büyük iyiliği yaptın (+8 İnci toplandı)!";
        routineBox.appendChild(fullDayCelebration);
      }
    } catch (err) {
      routineBox.innerHTML = `<p style="color: var(--color-danger);">Rutin bilgisi yüklenemedi: ${err.message}</p>`;
    }
  }

  // ==========================================
  // DİJİTAL DOLAP & PAO (SKT) BÖLÜMÜ
  // ==========================================
  async renderVanitySection(container) {
    const vanityBox = document.createElement("div");
    vanityBox.innerHTML = `<div style="text-align: center; padding: 20px;"><div class="skeleton skeleton-block"></div><p>Dijital dolabınız yükleniyor...</p></div>`;
    container.appendChild(vanityBox);

    try {
      const res = await routineService.getVanity();
      const items = res.data?.items || [];
      const safety = res.data?.safetyScore || { score: 100, label: "Tertemiz Başlangıç", freshCount: 0, expiredCount: 0 };

      vanityBox.innerHTML = "";

      // Üst Skor & Story Paylaşım Kartı
      const scoreCard = document.createElement("div");
      scoreCard.style.cssText = "background: linear-gradient(135deg, #FFF0F4 0%, #FFFFFF 100%); border: 1px solid var(--color-primary-200); border-radius: var(--radius-lg); padding: var(--space-3); margin-bottom: var(--space-4); box-shadow: var(--shadow-sm);";

      scoreCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-size: 11px; color: var(--color-text-muted); font-weight: 700; text-transform: uppercase;">Cilt Çantası Güvenlik Skoru</div>
            <div style="font-size: 24px; font-weight: 800; color: ${safety.score >= 80 ? '#2E7D32' : (safety.score >= 50 ? '#ED6C02' : '#D32F2F')};">
              ${safety.score} <span style="font-size: 14px; font-weight: 600; color: var(--color-text-muted);">/ 100 PUAN</span>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: var(--color-primary-dark); margin-top: 2px;">
              ${safety.label}
            </div>
          </div>
          <button id="openShareStoryFromVanity" class="btn btn-primary btn-sm" style="font-weight: 700;">
            📲 Story Kartı Oluştur
          </button>
        </div>
        <div style="display: flex; gap: 8px; margin-top: var(--space-2); font-size: 11px; color: var(--color-text-muted);">
          <span>✅ ${safety.freshCount || 0} Taze Ürün</span> •
          <span>⚠️ ${safety.expiringSoonCount || 0} Son 30 Gün</span> •
          <span>❌ ${safety.expiredCount || 0} Süresi Dolmuş</span>
        </div>
      `;
      vanityBox.appendChild(scoreCard);

      scoreCard.querySelector("#openShareStoryFromVanity").onclick = () => {
        const name = this.profileData.firstName ? `${this.profileData.firstName} ${this.profileData.lastName || ""}` : "İnci Kaşifi";
        new ShareCardModal().show({
          userName: name.trim(),
          skinType: this.profileData.skinType || "Karma Cilt",
          streakCount: this.streakCount,
          points: this.userPoints,
          safetyScore: safety.score,
          freshCount: safety.freshCount || 0,
          expiredCount: safety.expiredCount || 0
        });
      };

      // Yeni Ürün Ekle Butonu
      const addRow = document.createElement("div");
      addRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);";
      addRow.innerHTML = `
        <h3 style="margin: 0; font-size: 15px; color: var(--color-text);">Dolabımdaki Ürünler (${items.length})</h3>
        <button id="addNewVanityItemBtn" class="btn btn-secondary btn-sm" style="font-weight: 700;">
          ➕ Yeni Ürün Ekle
        </button>
      `;
      vanityBox.appendChild(addRow);

      addRow.querySelector("#addNewVanityItemBtn").onclick = () => this.openAddVanityModal();

      // Ürün Kartları Listesi
      if (items.length === 0) {
        const emptyNotice = document.createElement("div");
        emptyNotice.style.cssText = "text-align: center; padding: var(--space-5); background: #FDFDFE; border: 1px dashed var(--color-border); border-radius: var(--radius-md);";
        emptyNotice.innerHTML = `
          <div style="font-size: 32px; margin-bottom: 8px;">🧴</div>
          <strong style="color: var(--color-text);">Dolabınız Henüz Boş</strong>
          <p style="font-size: 12px; color: var(--color-text-muted); margin: 6px 0 0 0;">
            Açtığınız kozmetik ürünleri ekleyin; arkasındaki kavanoz simgesine (PAO) göre bozulma tarihlerini sizin için takip edelim.
          </p>
        `;
        vanityBox.appendChild(emptyNotice);
      } else {
        const grid = document.createElement("div");
        grid.style.cssText = "display: flex; flex-direction: column; gap: var(--space-2);";

        items.forEach((item) => {
          const itemCard = document.createElement("div");
          const isExpired = item.status === "EXPIRED";
          const isWarning = item.status === "EXPIRING_SOON";

          itemCard.style.cssText = `
            background: #FFF; border: 1px solid ${isExpired ? '#FCA5A5' : (isWarning ? '#FCD34D' : '#E5E7EB')};
            border-left: 4px solid ${isExpired ? '#EF4444' : (isWarning ? '#F59E0B' : '#10B981')};
            border-radius: var(--radius-md); padding: var(--space-3); display: flex; justify-content: space-between; align-items: center;
          `;

          const openDateFormatted = item.openedAt ? new Date(item.openedAt).toLocaleDateString("tr-TR") : "-";

          itemCard.innerHTML = `
            <div style="flex: 1; padding-right: 12px;">
              <div style="font-weight: 700; font-size: 14px; color: var(--color-text);">${item.name}</div>
              <div style="font-size: 11px; color: var(--color-text-muted); margin: 2px 0;">
                ${item.brand ? `<strong>${item.brand}</strong> • ` : ''}Açılış: ${openDateFormatted} (${item.paoMonths} Ay PAO)
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                <span class="badge ${isExpired ? 'badge-danger' : (isWarning ? 'badge-warning' : 'badge-success')}" style="font-size: 10px;">
                  ${item.statusTextTr}
                </span>
                <span style="font-size: 11px; font-weight: 600; color: ${isExpired ? '#B91C1C' : '#4B5563'};">
                  ${isExpired ? 'Süresi Doldu!' : `${item.daysRemaining} Gün Kaldı`}
                </span>
              </div>
            </div>
            <button class="delete-vanity-item-btn btn btn-sm btn-outline" style="color: #9CA3AF; border-color: #E5E7EB; font-size: 11px;" title="Dolaptan Kaldır">
              🗑️ Kaldır
            </button>
          `;

          itemCard.querySelector(".delete-vanity-item-btn").onclick = async () => {
            if (confirm(`'${item.name}' ürününü dolabınızdan kaldırmak istiyor musunuz?`)) {
              try {
                await routineService.removeVanityItem(item.id);
                toast.info("Ürün dolaptan kaldırıldı.");
                this.render();
              } catch (err) {
                toast.error(err.message || "Silinirken hata oluştu.");
              }
            }
          };

          grid.appendChild(itemCard);
        });

        vanityBox.appendChild(grid);
      }
    } catch (err) {
      vanityBox.innerHTML = `<p style="color: var(--color-danger);">Dolap bilgisi yüklenemedi: ${err.message}</p>`;
    }
  }

  openAddVanityModal() {
    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";

    const todayStr = new Date().toISOString().slice(0, 10);

    modalBackdrop.innerHTML = `
      <div class="modal-container" style="max-width: 440px;">
        <div class="card-header">
          <h3 class="card-title">🧴 Dolaba Ürün Ekle</h3>
          <button id="closeAddVanityModalBtn" class="btn btn-sm btn-outline">✕ Kapat</button>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Ürün Adı *</label>
            <input type="text" id="addVanityName" class="form-input" placeholder="Örn: Salisilik Asit Serumu" required />
          </div>
          <div class="form-group">
            <label class="form-label">Marka</label>
            <input type="text" id="addVanityBrand" class="form-input" placeholder="Örn: CeraVe" />
          </div>
          <div class="form-group">
            <label class="form-label">Açılış Tarihi</label>
            <input type="date" id="addVanityOpenedAt" class="form-input" value="${todayStr}" />
          </div>
          <div class="form-group">
            <label class="form-label">Kullanım Süresi (PAO)</label>
            <select id="addVanityPao" class="form-input">
              <option value="3">3 Ay (3M)</option>
              <option value="6" selected>6 Ay (6M)</option>
              <option value="12">12 Ay (12M)</option>
              <option value="24">24 Ay (24M)</option>
            </select>
          </div>
          <div style="margin-top: var(--space-4);">
            <button id="confirmSaveVanityBtn" class="btn btn-primary" style="width: 100%; font-weight: 700;">
              🧴 Dolabıma Ekle
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    modalBackdrop.querySelector("#closeAddVanityModalBtn").onclick = () => modalBackdrop.remove();

    const saveBtn = modalBackdrop.querySelector("#confirmSaveVanityBtn");
    saveBtn.onclick = async () => {
      const name = modalBackdrop.querySelector("#addVanityName").value.trim();
      const brand = modalBackdrop.querySelector("#addVanityBrand").value.trim();
      const openedAt = modalBackdrop.querySelector("#addVanityOpenedAt").value;
      const paoMonths = parseInt(modalBackdrop.querySelector("#addVanityPao").value, 10);

      if (!name) {
        toast.warning("Lütfen ürün adını giriniz.");
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Ekleniyor...";

      try {
        await routineService.addVanityItem({ name, brand, openedAt, paoMonths });
        toast.success(`'${name}' dolabınıza eklendi!`);
        modalBackdrop.remove();
        this.render();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Tekrar Dene";
        toast.error(err.message || "Eklenirken hata oluştu.");
      }
    };
  }
}
