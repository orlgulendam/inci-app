// public/js/views/ProfileWizardView.js - Cilt Profili Sihirbazı (Wizard Pattern & SRP)
import { profileService } from "../services/profileService.js";
import { store } from "../state/store.js";
import { toast } from "../components/Toast.js";

export class ProfileWizardView {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.currentStep = 1;
    this.totalSteps = 4;

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
        this.profileData.firstName = res.firstName || "";
        this.profileData.lastName = res.lastName || "";
        const p = res.skinProfile || {};
        this.profileData.skinType = p.skinType || "karma";
        this.profileData.conditions = Array.isArray(p.conditions) ? [...p.conditions] : [];
        this.profileData.allergicIngredients = Array.isArray(p.allergicIngredients) ? [...p.allergicIngredients] : [];
        this.profileData.hasAllergy = this.profileData.allergicIngredients.length > 0;
        this.profileData.frequentlyUsedProducts = Array.isArray(p.frequentlyUsedProducts) ? [...p.frequentlyUsedProducts] : [];
        this.profileData.routineMedications = Array.isArray(p.routineMedications) ? [...p.routineMedications] : [];
        this.profileData.dermatologistNotes = p.dermatologistNotes || "";
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

    // Stepper Göstergesi
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
        const isSelected = this.profileData.allergicIngredients.includes(item);
        const chip = document.createElement("div");
        chip.className = `chip ${isSelected ? "active" : ""}`;
        chip.textContent = item;
        chip.onclick = () => {
          if (isSelected) {
            this.profileData.allergicIngredients = this.profileData.allergicIngredients.filter(x => x !== item);
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
          if (!this.profileData.allergicIngredients.includes(it)) {
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
      const isSelected = this.profileData.targetedBenefits.includes(b);
      const chip = document.createElement("div");
      chip.className = `chip ${isSelected ? "active" : ""}`;
      chip.textContent = b;
      chip.onclick = () => {
        if (isSelected) {
          this.profileData.targetedBenefits = this.profileData.targetedBenefits.filter(x => x !== b);
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
}
