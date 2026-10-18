// public/js/views/AuthView.js - Kimlik Doğrulama, E-posta Onay ve Parola Sıfırlama Görünümü (SRP)
import { authService } from "../services/authService.js";
import { store } from "../state/store.js";
import { toast } from "../components/Toast.js";

export class AuthView {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.mode = "login"; // "login" | "register" | "forgot" | "verify"
    this.lastRegisteredEmail = "";
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  render() {
    this.container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "460px";
    card.style.margin = "var(--space-6) auto";

    const header = document.createElement("div");
    header.className = "card-header";
    const title = document.createElement("h2");
    title.className = "card-title";

    if (this.mode === "login") title.textContent = "Giriş Yap";
    else if (this.mode === "register") title.textContent = "Hesap Oluştur";
    else if (this.mode === "forgot") title.textContent = "Şifremi Unuttum";
    else if (this.mode === "verify") title.textContent = "E-posta Doğrulama";

    header.appendChild(title);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";

    if (this.mode === "login") {
      body.appendChild(this.renderLoginForm());
    } else if (this.mode === "register") {
      body.appendChild(this.renderRegisterForm());
    } else if (this.mode === "forgot") {
      body.appendChild(this.renderForgotForm());
    } else if (this.mode === "verify") {
      body.appendChild(this.renderVerifyScreen());
    }

    card.appendChild(body);
    this.container.appendChild(card);
  }

  renderLoginForm() {
    const form = document.createElement("form");

    // E-posta
    const emailGroup = document.createElement("div");
    emailGroup.className = "form-group";
    emailGroup.innerHTML = `
      <label class="form-label" for="loginEmail">E-posta Adresi</label>
      <input type="email" id="loginEmail" class="form-input" placeholder="adiniz@ornek.com" required autocomplete="email" />
    `;
    form.appendChild(emailGroup);

    // Parola
    const passGroup = document.createElement("div");
    passGroup.className = "form-group";
    passGroup.innerHTML = `
      <label class="form-label" for="loginPassword">Parola</label>
      <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required autocomplete="current-password" />
    `;
    form.appendChild(passGroup);

    // Giriş Butonu
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary btn-block";
    submitBtn.textContent = "Giriş Yap";
    form.appendChild(submitBtn);

    // Alt Linkler
    const footerLinks = document.createElement("div");
    footerLinks.style.marginTop = "var(--space-4)";
    footerLinks.style.display = "flex";
    footerLinks.style.justifyContent = "space-between";
    footerLinks.style.fontSize = "var(--font-size-sm)";

    const forgotLink = document.createElement("a");
    forgotLink.href = "#";
    forgotLink.textContent = "Şifremi Unuttum";
    forgotLink.style.color = "var(--color-primary-700)";
    forgotLink.onclick = (e) => { e.preventDefault(); this.setMode("forgot"); };
    footerLinks.appendChild(forgotLink);

    const regLink = document.createElement("a");
    regLink.href = "#";
    regLink.textContent = "Hesabınız yok mu? Kaydolun";
    regLink.style.color = "var(--color-primary-700)";
    regLink.onclick = (e) => { e.preventDefault(); this.setMode("register"); };
    footerLinks.appendChild(regLink);

    form.appendChild(footerLinks);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = form.querySelector("#loginEmail").value.trim();
      const password = form.querySelector("#loginPassword").value;

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Giriş yapılıyor...";
        await authService.login({ email, password });
        toast.success("Başarıyla giriş yapıldı.");

        const isVerified = store.isEmailVerified();
        if (!isVerified) {
          this.lastRegisteredEmail = email;
          this.setMode("verify");
        } else {
          this.onNavigate("home");
        }
      } catch (err) {
        toast.error(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Giriş Yap";
      }
    };

    return form;
  }

  renderRegisterForm() {
    const form = document.createElement("form");

    // Ad & Soyad
    const nameRow = document.createElement("div");
    nameRow.style.display = "grid";
    nameRow.style.gridTemplateColumns = "1fr 1fr";
    nameRow.style.gap = "var(--space-2)";
    nameRow.innerHTML = `
      <div class="form-group">
        <label class="form-label" for="regFirstName">Adınız</label>
        <input type="text" id="regFirstName" class="form-input" placeholder="Gülendam" />
      </div>
      <div class="form-group">
        <label class="form-label" for="regLastName">Soyadınız</label>
        <input type="text" id="regLastName" class="form-input" placeholder="Yılmaz" />
      </div>
    `;
    form.appendChild(nameRow);

    // E-posta
    const emailGroup = document.createElement("div");
    emailGroup.className = "form-group";
    emailGroup.innerHTML = `
      <label class="form-label" for="regEmail">E-posta Adresi</label>
      <input type="email" id="regEmail" class="form-input" placeholder="adiniz@ornek.com" required autocomplete="email" />
    `;
    form.appendChild(emailGroup);

    // Parola
    const passGroup = document.createElement("div");
    passGroup.className = "form-group";
    passGroup.innerHTML = `
      <label class="form-label" for="regPassword">Parola (En az 6 karakter)</label>
      <input type="password" id="regPassword" class="form-input" placeholder="••••••••" required minlength="6" autocomplete="new-password" />
    `;
    form.appendChild(passGroup);

    // KVKK Aydınlatma & Onay Kutusu
    const kvkkGroup = document.createElement("div");
    kvkkGroup.className = "form-group";
    kvkkGroup.innerHTML = `
      <label style="display:flex; align-items:flex-start; gap:var(--space-2); font-size:var(--font-size-xs); color:var(--color-text-muted); cursor:pointer;">
        <input type="checkbox" id="regKvkk" required style="margin-top:2px;" />
        <span>Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca cilt profili ve alerjen verilerimin ürün analizi amacıyla işlenmesini onaylıyorum.</span>
      </label>
    `;
    form.appendChild(kvkkGroup);

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary btn-block";
    submitBtn.textContent = "Kayıt Ol";
    form.appendChild(submitBtn);

    const backLink = document.createElement("div");
    backLink.style.marginTop = "var(--space-3)";
    backLink.style.textAlign = "center";
    backLink.innerHTML = `<a href="#" style="color:var(--color-primary-700); font-size:var(--font-size-sm);">Zaten hesabınız var mı? Giriş yapın</a>`;
    backLink.querySelector("a").onclick = (e) => { e.preventDefault(); this.setMode("login"); };
    form.appendChild(backLink);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = form.querySelector("#regEmail").value.trim();
      const password = form.querySelector("#regPassword").value;
      const firstName = form.querySelector("#regFirstName").value.trim();
      const lastName = form.querySelector("#regLastName").value.trim();

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Kaydediliyor...";
        const res = await authService.register({ email, password, firstName, lastName });
        this.lastRegisteredEmail = email;
        toast.success("Kayıt başarılı! Lütfen e-posta adresinizi doğrulayınız.");
        this.setMode("verify");
      } catch (err) {
        toast.error(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Kayıt Ol";
      }
    };

    return form;
  }

  renderVerifyScreen() {
    const box = document.createElement("div");
    box.style.textAlign = "center";

    const icon = document.createElement("div");
    icon.style.fontSize = "3rem";
    icon.textContent = "✉️";
    box.appendChild(icon);

    const sub = document.createElement("h3");
    sub.style.marginTop = "var(--space-2)";
    sub.style.color = "var(--color-primary-800)";
    sub.textContent = "E-posta Doğrulama Bağlantısı Gönderildi";
    box.appendChild(sub);

    const desc = document.createElement("p");
    desc.style.fontSize = "var(--font-size-sm)";
    desc.style.color = "var(--color-text-muted)";
    desc.style.margin = "var(--space-3) 0";
    desc.textContent = `Doğrulama bağlantısını ${this.lastRegisteredEmail || "kayıtlı e-posta"} adresinize ilettik. Cilt profilinizi oluşturmak için lütfen gelen kutunuzu kontrol edin.`;
    box.appendChild(desc);

    // Manuel Token Giriş Kutusu (Dev / Test ve Link simülasyonu için)
    const tokenForm = document.createElement("form");
    tokenForm.style.marginTop = "var(--space-4)";
    tokenForm.onsubmit = async (e) => {
      e.preventDefault();
      const token = tokenInput.value.trim();
      if (!token) return;

      try {
        await authService.verifyEmail(token);
        toast.success("E-posta adresiniz başarıyla doğrulandı!");
        this.onNavigate("profile");
      } catch (err) {
        toast.error(err.message);
      }
    };

    const tokenInput = document.createElement("input");
    tokenInput.className = "form-input";
    tokenInput.placeholder = "Doğrulama kodunu buraya yapıştırabilirsiniz";
    tokenInput.style.marginBottom = "var(--space-2)";
    tokenForm.appendChild(tokenInput);

    const verifyBtn = document.createElement("button");
    verifyBtn.type = "submit";
    verifyBtn.className = "btn btn-primary btn-block";
    verifyBtn.textContent = "Kodu Doğrula";
    tokenForm.appendChild(verifyBtn);

    box.appendChild(tokenForm);

    // Tekrar Gönder Butonu
    const resendBtn = document.createElement("button");
    resendBtn.className = "btn btn-outline btn-block";
    resendBtn.style.marginTop = "var(--space-2)";
    resendBtn.textContent = "Doğrulama E-postasını Tekrar Gönder";
    resendBtn.onclick = async () => {
      const email = this.lastRegisteredEmail || store.getState().user?.email;
      if (!email) {
        toast.error("Lütfen e-posta adresinizi giriniz.");
        return;
      }
      try {
        await authService.resendVerification(email);
        toast.success("Yeni doğrulama linki oluşturuldu.");
      } catch (err) {
        toast.error(err.message);
      }
    };
    box.appendChild(resendBtn);

    return box;
  }

  renderForgotForm() {
    const form = document.createElement("form");

    const emailGroup = document.createElement("div");
    emailGroup.className = "form-group";
    emailGroup.innerHTML = `
      <label class="form-label" for="forgotEmail">Kayıtlı E-posta Adresiniz</label>
      <input type="email" id="forgotEmail" class="form-input" placeholder="adiniz@ornek.com" required />
    `;
    form.appendChild(emailGroup);

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary btn-block";
    submitBtn.textContent = "Şifre Sıfırlama Bağlantısı Gönder";
    form.appendChild(submitBtn);

    const backLink = document.createElement("div");
    backLink.style.marginTop = "var(--space-3)";
    backLink.style.textAlign = "center";
    backLink.innerHTML = `<a href="#" style="color:var(--color-primary-700); font-size:var(--font-size-sm);">Giriş ekranına dön</a>`;
    backLink.querySelector("a").onclick = (e) => { e.preventDefault(); this.setMode("login"); };
    form.appendChild(backLink);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = form.querySelector("#forgotEmail").value.trim();
      try {
        submitBtn.disabled = true;
        const res = await authService.forgotPassword(email);
        toast.success(res.message);
      } catch (err) {
        toast.error(err.message);
      } finally {
        submitBtn.disabled = false;
      }
    };

    return form;
  }
}
