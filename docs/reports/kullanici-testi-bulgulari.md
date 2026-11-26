# INCI Engine — Uçtan Uca Kullanıcı Testi Bulguları

**Tarih:** 26.11.2026
**Ortam:** Windows 11, Node.js 20, MongoDB 7 (standalone, `mongodb://localhost:27017`, `obf` veritabanı — 55.649 ürün / 30.394 bileşen / 12.565 marka), `npm run dev` → `http://localhost:3000`
**Tarayıcı:** Mobil görünüm 375×812 (telefon ölçüsü), konsol ve ağ istekleri her adımda izlendi
**Test kullanıcıları:** `uxtest1@inci.local` (arayüzden kayıt edildi), `test@inci.local` (mevcut yerel test kullanıcısı)
**Başlangıç durumu:** `npm test` → 98/98 geçiyor

---

## Özet

| Ciddiyet | Adet | Düzeltildi | Kullanıcı kararı bekliyor |
|---|---|---|---|
| Engelleyici | 6 | 6 | 0 |
| Yüksek | 7 | 7 | 0 |
| Orta | 14 | 9 | 5 |
| Düşük | 6 | 2 | 4 |
| **Toplam** | **33** | **24** | **9** |

Ayrıca tarayıcıda çalıştırılamayan Capacitor/Android tarafı için 7 risk maddesi ayrı başlıkta toplandı.

---

# 1. ENGELLEYİCİ BULGULAR

## B-01 — Herkes kendini yönetici (admin) olarak kaydedebiliyor

- **Ciddiyet:** Engelleyici
- **Nerede:** `POST /api/v1/auth/register`

**Tekrar adımları**
1. Sunucu ayaktayken şu isteği gönderin:
   ```
   POST /api/v1/auth/register
   {"email":"pentest-admin@example.com","password":"Parola123","role":"admin"}
   ```
2. Dönen yanıta bakın.
3. Aynı bilgilerle `POST /api/v1/auth/login` yapıp dönen JWT ile `GET /api/v1/admin/users` çağırın.

**Beklenen:** `role` alanı yok sayılmalı, kullanıcı her zaman `user` rolüyle oluşmalı.
**Gerçekleşen:** Kullanıcı `"role":"admin"` olarak oluşuyor, JWT içine `role: admin` yazılıyor ve `/api/v1/admin/users` tüm kullanıcıların kayıtlarını döndürüyor. Canlı olarak doğrulandı.

**Kök neden:** `src/modules/personalization/presentation/controllers/AuthController.js:8-9` — `role` istek gövdesinden okunup servise iletiliyor; `src/modules/personalization/application/services/AuthService.js:15` bu değeri doğrudan `new User({ role })` içine koyuyor.

**Önerilen çözüm:** Kayıt uç noktasında `role` hiç okunmasın; yeni kullanıcı daima `user` rolüyle açılsın. Yönetici ataması yalnızca veritabanı/operasyon tarafından yapılsın.

---

## B-02 — Şifre sıfırlama belirteci API yanıtında dönüyor (hesap ele geçirme)

- **Ciddiyet:** Engelleyici
- **Nerede:** `POST /api/v1/auth/forgot-password` + `POST /api/v1/auth/reset-password`

**Tekrar adımları**
1. `POST /api/v1/auth/forgot-password` → `{"email":"<kurbanın e-postası>"}`
2. Yanıttaki `data.resetToken` değerini kopyalayın.
3. `POST /api/v1/auth/reset-password` → `{"token":"<kopyalanan>","newPassword":"SaldirganParolasi1"}`
4. Yeni parolayla giriş yapın.

**Beklenen:** Belirteç yalnızca kullanıcının e-posta kutusuna gitmeli, HTTP yanıtında asla bulunmamalı.
**Gerçekleşen:** Belirteç yanıt gövdesinde dönüyor; 3 istekte, yalnızca e-posta adresini bilerek herhangi bir hesabın parolası değiştirilebiliyor. Uçtan uca doğrulandı (test hesabı üzerinde).

**Kök neden:** `src/modules/personalization/application/services/AuthService.js` → `forgotPassword()` dönüşünde `resetToken` alanı var (`// Dev/Test ortamı için` notuyla) ve ortam ayrımı yapılmıyor.

**Önerilen çözüm:** `resetToken` yalnızca `NODE_ENV !== "production"` iken dönsün. Üretimde e-posta gönderimi devreye alınana kadar bu uç nokta yalnızca genel mesaj döndürsün.

---

## B-03 — E-posta doğrulama belirteci kayıt yanıtında dönüyor

- **Ciddiyet:** Engelleyici
- **Nerede:** `POST /api/v1/auth/register`, `POST /api/v1/auth/resend-verification`

**Tekrar adımları**
1. Arayüzden yeni bir hesap açın.
2. Doğrulama ekranında kodun kutuya kendiliğinden yazıldığını görün ("✨ Geliştirme ortamı: Doğrulama kodu otomatik tanımlandı").
3. `POST /api/v1/auth/register` ham yanıtına bakın: `verificationToken` alanı var.

**Beklenen:** Doğrulama bağlantısı yalnızca e-posta ile gitmeli.
**Gerçekleşen:** Belirteç yanıtta dönüyor ve arayüz onu kutuya kendi yazıyor; e-posta doğrulama adımı tamamen anlamsızlaşıyor. Üretimde kullanıcı "Geliştirme ortamı" yazısını görür.

**Kök neden:** `AuthService.register()` / `AuthService.resendVerification()` dönüş nesneleri; `public/js/views/AuthView.js:210, 265-272`.

**Önerilen çözüm:** Belirteci yalnızca üretim dışı ortamda dön; arayüzdeki otomatik doldurma ve "Geliştirme ortamı" ipucu da yalnızca belirteç geldiğinde görünsün (zaten öyle çalışıyor, belirteç gelmeyince kendiliğinden kaybolur).

---

## B-04 — Moderasyon uç noktaları kimlik doğrulamasız

- **Ciddiyet:** Engelleyici
- **Nerede:** `GET /api/v1/contributions/pending`, `POST /api/v1/contributions/:id/approve`, `POST /api/v1/contributions/:id/reject`

**Tekrar adımları**
1. Hiçbir `Authorization` başlığı göndermeden `GET /api/v1/contributions/pending` isteyin.
2. Yanıtın 200 döndüğünü ve bekleyen katkıları (kullanıcı kimlikleriyle birlikte) listelediğini görün.
3. Aynı şekilde `POST /api/v1/contributions/<id>/approve` çağırın.

**Beklenen:** 401/403.
**Gerçekleşen:** 200. Onay akışı kataloğa ürün yazar ve kullanıcıya 50 puan verir; yani kimliksiz bir istemci katalogu kirletebilir ve puan dağıtabilir.

**Kök neden:** `src/modules/community/presentation/routes/communityRoutes.js:14-17` — bu üç rotada hiçbir middleware yok.

**Önerilen çözüm:** Üçüne de `authMiddleware` + `adminMiddleware` ekle.

---

## B-05 — Yönetici kullanıcı listesi doğrulama/sıfırlama belirteçlerini ve sağlık verisini döndürüyor

- **Ciddiyet:** Engelleyici
- **Nerede:** `GET /api/v1/admin/users`

**Tekrar adımları**
1. Yönetici belirteciyle `GET /api/v1/admin/users?limit=20` çağırın.
2. Dönen alanlara bakın.

**Beklenen:** Yalnızca yönetim için gereken alanlar (ad, e-posta, rol, doğrulanma durumu, puan).
**Gerçekleşen:** `emailVerificationToken`, `passwordResetToken`, `passwordResetExpires` ve eksiksiz `skinProfile` (KVKK m.6 özel nitelikli sağlık verisi: cilt durumları, alerjenler, ilaçlar, dermatolog notları) dönüyor. B-01 ile birleşince herhangi bir kullanıcı admin olup tüm kullanıcıların belirteçlerini ve sağlık verisini okuyabiliyor.

**Kök neden:** `src/modules/personalization/application/services/AdminService.js` / `MongoUserRepository` kullanıcı nesnesini olduğu gibi döndürüyor.

**Önerilen çözüm:** Yanıtı açık bir alan beyaz listesine indir; belirteçleri ve `skinProfile` ayrıntısını hiç gönderme.

---

## B-06 — Mobil API adresi emülatör adresine sabitlenmiş

- **Ciddiyet:** Engelleyici (yayın için)
- **Nerede:** `public/js/config.js:26`

**Tekrar adımları**
1. `public/js/config.js` dosyasını açın.
2. `MOBILE_API_BASE_URL` değerine bakın: `"http://10.0.2.2:3000"`.
3. `npx cap sync android` ile APK derlendiğinde bu değer uygulamanın içine gömülür.

**Beklenen:** Yayın derlemesinde üretim API adresi (`https://api.<alan-adi>`).
**Gerçekleşen:** `10.0.2.2` yalnızca **Android emülatöründe** ana makinenin localhost'udur. Gerçek bir telefonda bu adrese hiçbir şekilde ulaşılamaz; Play Store'dan indirilen uygulamada arama, barkod, OCR, giriş — hiçbir API çağrısı çalışmaz.

**Önerilen çözüm:** Yayından önce üretim adresine çevir. Kod içinde uyarı yorumu zaten var ama derlemeyi durduran bir kontrol yok; `cap sync` öncesi çalışan basit bir kontrol betiği eklenebilir.

---

# 2. YÜKSEK ÖNCELİKLİ BULGULAR

## Y-01 — `toast.warning()` diye bir fonksiyon yok; 8 çağrı sessizce patlıyor

- **Ciddiyet:** Yüksek
- **Nerede:** `public/js/components/Toast.js` (eksik metot) — çağıran 8 nokta `HomeScanView.js` ve `ProfileWizardView.js` içinde

**Tekrar adımları**
1. Giriş yapmadan ana sayfayı açın.
2. Barkod kutusuna katalogda olmayan bir barkod yazıp **Sorgula**'ya basın → "Barkodu Henüz Kayıtlı Değil" kartı gelir.
3. **➕ Bu Ürünü Sisteme Ekle (+50 Puan)** butonuna basın.

**Beklenen:** "Katkı göndermek için lütfen önce giriş yapınız" uyarısı.
**Gerçekleşen:** Hiçbir şey olmuyor. Konsolda `Uncaught TypeError: toast.warning is not a function at HomeScanView.openContributionModal (HomeScanView.js:1003)`. Buton tamamen ölü.

**Etkilenen akışlar (hepsi aynı kök nedenden):**
| Satır | Kırılan davranış |
|---|---|
| `HomeScanView.js:500` | OCR hiçbir şey okuyamadığında kullanıcıya **hiç geri bildirim verilmiyor** ve sonuç alanı bomboş kalıyor (aşağıda ayrıca doğrulandı) |
| `HomeScanView.js:1003` | Misafirin "Bu Ürünü Sisteme Ekle" butonu ölü |
| `HomeScanView.js:1048` | Katkı formunda "Barkod ve ürün adı zorunludur" doğrulaması çalışmıyor |
| `HomeScanView.js:1119` | Misafirin "Hata Bildir" butonu ölü |
| `HomeScanView.js:1155` | Hata bildirim formu doğrulaması çalışmıyor |
| `HomeScanView.js:1266` | Misafirin "Dolabıma Ekle" butonu ölü |
| `HomeScanView.js:1327` | Dolap formunda boş ürün adı doğrulaması çalışmıyor |
| `ProfileWizardView.js:976` | Dolap ekleme doğrulaması çalışmıyor |

**Ek kanıt (OCR):** Giriş yapmadan bir görsel yükleyip OCR'ın metin bulamadığı durumda `.results-section` tamamen boşaldı, hiçbir mesaj gösterilmedi. Beklenen "Net bir ürün veya içerik metni tespit edilemedi..." kartı `toast.warning` satırında atılan istisna yüzünden hiç oluşturulmuyor.

**Kök neden:** `ToastManager` sınıfında yalnızca `success`, `error`, `info` tanımlı (`public/js/components/Toast.js:49-51`).

**Önerilen çözüm:** `warning(msg)` metodunu ekle (`toast-warning` sınıfıyla) ve CSS'te karşılığını tanımla.

---

## Y-02 — Misafirin "Giriş Yap / Cilt Profili Oluştur" butonu çalışmıyor

- **Ciddiyet:** Yüksek
- **Nerede:** Ana sayfa → misafir güvenlik kartı (`HomeScanView.js:898`)

**Tekrar adımları**
1. Giriş yapmadan barkod kutusuna `0018787788059` yazıp **Sorgula**'ya basın.
2. Gelen kartın altındaki **"Giriş Yap / Cilt Profili Oluştur"** butonuna basın.

**Beklenen:** Giriş ekranına gidilmesi.
**Gerçekleşen:** Hiçbir şey olmuyor. Konsol: `Uncaught TypeError: this.onNavigate is not a function at ctaBtn.onclick (HomeScanView.js:898:35)`.

**Kök neden:** `public/js/app.js:69` → `new HomeScanView(this.mainContainer)` — ikinci parametre (`onNavigate`) hiç verilmiyor; `AuthView` ve `ProfileWizardView` alıyor, `HomeScanView` almıyor.

**Önerilen çözüm:** `new HomeScanView(this.mainContainer, (v) => this.navigate(v))`.

> Bu, misafiri üye yapan tek dönüşüm butonu. Play Store'a çıkmadan mutlaka kapanmalı.

---

## Y-03 — Ağ/sunucu hatasında kullanıcıya "Bu barkod kayıtlı değil" deniyor

- **Ciddiyet:** Yüksek
- **Nerede:** `HomeScanView.processBarcode()` catch bloğu (`HomeScanView.js:967-995`)

**Tekrar adımları**
1. Uygulamayı açın, sonra sunucuyu durdurun (ya da telefonun internetini kapatın).
2. Geçerli bir barkod (örn. `3337875597180`) sorgulayın.

**Beklenen:** "Sunucuya ulaşılamadı, bağlantınızı kontrol edin" türü bir hata kartı ve "Tekrar Dene" butonu.
**Gerçekleşen:** "✨ '3337875597180' Barkodu Henüz Kayıtlı Değil — Bu ürünü topluluğumuzda ilk keşfeden sen olabilirsin!" kartı çıkıyor. Doğrulandı (apiClient geçici olarak ulaşılamayan bir adrese yönlendirilerek).

**Etki:** Telefonda en sık karşılaşılacak hata (zayıf şebeke) kullanıcıya yanlış bilgi olarak gösteriliyor; kullanıcı katalogda **var olan** ürünü "yok" sanıp katkı formunu dolduruyor → mükerrer/yanlış katkı.

**Önerilen çözüm:** catch içinde hata türünü ayır: yalnızca `status === 404` veya `code === "NOT_FOUND"` ise "kayıtlı değil" kartı; diğerlerinde `CardFactory.createErrorCard()` ile tekrar deneme kartı.

---

## Y-04 — Dermatolog notu `[object Object]` olarak geri geliyor ve düzenlenince kalıcı bozuluyor

- **Ciddiyet:** Yüksek (veri kaybı)
- **Nerede:** Profil sihirbazı 4. adım (`ProfileWizardView.js:52`, `:576`)

**Tekrar adımları**
1. Giriş yapın, Profil → 4. adıma gidin.
2. "Dermatoloğunuzun Verdiği Tavsiyeler" alanına bir not yazın (örn. "Bariyer zayıf, peelingden kaçınılmalı.") ve **Profili Kaydet**'e basın.
3. Profil sayfasına tekrar girin ve 4. adıma gidin.
4. Not alanına bir harf ekleyip tekrar kaydedin.

**Beklenen:** 3. adımda yazdığınız notun aynen görünmesi; 4. adımda not + eklemenin kaydedilmesi.
**Gerçekleşen:**
- 3. adım: metin kutusunda `[object Object]` yazıyor.
- 4. adım: veritabanındaki not `"[object Object] ek not"` olarak **üzerine yazılıyor**. Orijinal dermatolog notu kalıcı olarak kayboluyor. Canlı doğrulandı.

**Kök neden:** Backend `dermatologistNotes` alanını `[{ note, date }]` dizisi olarak saklıyor (`SkinProfile.normalizeNotes`), arayüz ise `this.profileData.dermatologistNotes = p.dermatologistNotes || ""` ile diziyi düz metin gibi alıp `${...}` ile metin kutusuna basıyor.

**Önerilen çözüm:** Yüklerken diziyi `note` alanlarından metne çevir (`notes.map(n => n.note).join("\n")`).

---

## Y-05 — Kayıtlı cilt tipi, alerjen ve hedef seçimleri profilde "seçili" görünmüyor

- **Ciddiyet:** Yüksek
- **Nerede:** Profil sihirbazı 1., 2. ve 4. adımlar

**Tekrar adımları**
1. Profil sihirbazında **Kuru Cilt**'i, 2. adımda **Parabens** alerjenini, 4. adımda **Nemlendirme** hedefini seçip kaydedin.
2. Profil sayfasından çıkıp tekrar girin.
3. Üç adıma da bakın.

**Beklenen:** Seçtiğiniz çipler işaretli gelmeli.
**Gerçekleşen:** Hiçbiri işaretli değil; ekran hiç doldurulmamış gibi görünüyor. Doğrulandı:
- Cilt tipi: backend `"dry"` saklıyor, çip kimlikleri Türkçe (`kuru`) → eşleşmiyor.
- Alerjen: backend `"PARABENS"` saklıyor, çip metni `"Parabens"` → eşleşmiyor.
- Hedef: backend `"nemlendirme"` saklıyor, çip metni `"Nemlendirme"` → eşleşmiyor.

Dahası, hiç profil doldurmamış yeni kullanıcıda backend varsayılan olarak `"combination"` saklıyor ama arayüzde hiçbir çip işaretli değil — kullanıcı seçim yapmadığı hâlde sisteme "karma cilt" yazılmış oluyor.

**Kök neden:** `ProfileWizardView.loadInitialData()` (satır 46-53) backend'den gelen normalleştirilmiş (İngilizce / büyük harf / küçük harf) değerleri arayüz kimliklerine geri çevirmiyor.

**Önerilen çözüm:** Yüklemede ters eşleme uygula (`dry → kuru` vb.), alerjen ve hedef karşılaştırmalarını büyük/küçük harf duyarsız yap.

---

## Y-06 — Arama kutusuna yazılan HTML çalıştırılıyor (XSS)

- **Ciddiyet:** Yüksek (güvenlik)
- **Nerede:** `HomeScanView.js:161, 167-174, 186-196, 209, 540-570, 620-631, 670-682, 977-983, 1275-1310`; `AdminView.js:121-140, 159-176`; `ProfileWizardView.js:363-372, 576`

**Tekrar adımları**
1. Ana sayfadaki arama kutusuna şunu yazın:
   `zzqq<img src=x onerror="window.__xss=1">`
2. Tarayıcı konsolunda `window.__xss` değerine bakın.

**Beklenen:** Metin düz yazı olarak gösterilmeli.
**Gerçekleşen:** `window.__xss === true`. Yazılan HTML çalıştırıldı. Canlı doğrulandı.

**Daha ciddi varyantı (depolanmış XSS):** Aynı şablonlar veritabanından gelen ürün/marka adlarını da kaçışsız basıyor. Katalog 80.000 kayıtlı dış kaynaklı ve topluluk katkıları kullanıcı girdisi. Ayrıca `AdminView` kullanıcı ad/soyad/e-postasını kaçışsız basıyor: `firstName` alanına betik yazarak kayıt olan biri, yönetici paneli açıldığında **yöneticinin oturumunda** kod çalıştırabilir.

**Not:** `app.js` içinde CSP kapalı (`contentSecurityPolicy: false`, `src/app.js:17`), yani ikinci bir savunma hattı da yok.

**Önerilen çözüm:** Ortak bir `escapeHtml()` yardımcı fonksiyonu ekleyip kullanıcı/veritabanı kaynaklı tüm `${...}` eklemelerini bundan geçir; mümkün olan yerlerde `textContent` kullan.

---

## Y-07 — Katkı onayı hiçbir zaman çalışmıyor; kullanıcıya yanlış sebep bildiriliyor

- **Ciddiyet:** Yüksek
- **Nerede:** `POST /api/v1/contributions/:id/approve`

**Tekrar adımları**
1. Giriş yapmış bir kullanıcıyla `POST /api/v1/contributions` ile katkı gönderin, dönen `id`'yi not edin.
2. `GET /api/v1/contributions/pending` ile aynı katkının listelendiğini görün.
3. `POST /api/v1/contributions/<id>/approve` çağırın.

**Beklenen:** Katkı onaylanmalı, ürün kataloğa eklenmeli, kullanıcıya 50 puan yazılmalı.
**Gerçekleşen:** `404 — '<id>' ID'li katkı bulunamadı.` Oysa katkı az önce listelenmişti.

**Kök neden (sunucu logundan):**
```
ERROR  Error finding contribution: 6b089784...
error: "Transaction numbers are only allowed on a replica set member or mongos"
```
`ContributionService.approveContribution()` işlemi `withTransaction` içinde yürütüyor (`src/core/database/mongo.js:52`), ancak ortamdaki MongoDB **standalone** çalışıyor ve çok dokümanlı işlem (transaction) desteklemiyor. `MongoContributionRepository.findById()` her hatayı `catch` edip `null` döndürdüğü için (`MongoContributionRepository.js:38-41`) gerçek sebep yutulup "katkı bulunamadı" hatasına dönüşüyor.

**Etki:** Topluluk katkısı/oyunlaştırma zincirinin tamamı ölü — kullanıcı "50 puan kazanacaksınız" mesajını alıyor ama puan hiç gelmiyor, ürün kataloğa hiç girmiyor.

**Önerilen çözüm (iki parça):**
1. `findById` hatayı yutmasın; depo hatası yukarı taşınsın ki sebep görünür olsun. *(Bu oturumda düzeltildi.)*
2. Üretimde MongoDB'yi replica set / Atlas olarak çalıştır **veya** transaction desteklenmiyorsa işlemsiz (sıralı) yola düşen bir yedek uygula. **Bu mimari seçim kullanıcı kararı gerektirir — bkz. bölüm 5.**

---

# 3. ORTA ÖNCELİKLİ BULGULAR

## O-01 — İş kuralı hataları 500 "beklenmeyen hata" olarak dönüyor

- **Ciddiyet:** Orta
- **Nerede:** `POST /personalization/routine/complete-step`, `POST /personalization/vanity`, `POST /personalization/chest/claim`

**Tekrar adımları**
1. `POST /api/v1/personalization/chest/claim` (serisi 7 günden az bir kullanıcıyla).
2. `POST /api/v1/personalization/vanity` → `{"name":""}`.
3. `POST /api/v1/personalization/routine/complete-step` → `{"type":"ogle"}`.

**Beklenen:** 400 ve anlamlı Türkçe mesaj ("İstiridye sandığını açmak için en az 7 günlük seri gerekir. Mevcut seriniz: 1" gibi — bu metin kodda zaten yazılı).
**Gerçekleşen:** Üçü de `500 INTERNAL_SERVER_ERROR — "Sunucuda beklenmeyen bir hata meydana geldi."`. Kullanıcı neyi yanlış yaptığını öğrenemiyor.

**Kök neden:** `User` varlığı düz `throw new Error(...)` kullanıyor (`User.js:186, 241, 306, 311`); `errorHandler` yalnızca `AppError` türevlerini operasyonel sayıyor (`src/core/middlewares/errorHandler.js:9`).

**Önerilen çözüm:** `ProfileService` içinde domain hatalarını `ValidationError`'a sarmala; mesaj korunur, HTTP 400 döner.

---

## O-02 — Profil tamamlanma yüzdesi iki yerde farklı hesaplanıyor

- **Ciddiyet:** Orta
- **Nerede:** `public/js/views/ProfileWizardView.js:61-70` ve `src/modules/personalization/domain/value-objects/SkinProfile.js:101-109`

**Tekrar adımları**
1. Yeni bir hesap açıp profil sayfasına gidin (hiçbir şey doldurmadan).
2. Üstteki rozete bakın.
3. `GET /api/v1/profile/skin` çağırıp `skinProfile.completionPercentage` değerine bakın.

**Beklenen:** İki sayı aynı olmalı.
**Gerçekleşen:** Arayüz **%65**, backend **%20** diyor. Hiçbir şey doldurmamış kullanıcıya "%65 tamamlandı" gösteriliyor.

**Etki:** "%100 doldur, +30 İnci kazan" vaadi backend'in sayısına göre işliyor; kullanıcı arayüzde %100 görüp ödül almayabilir (ya da tersi).

**Önerilen çözüm:** Arayüz kendi hesabını yapmasın, `GET /profile/skin` yanıtındaki `completionPercentage` değerini göstersin.

---

## O-03 — Yapay zeka, misafire ait olmayan bir cilt profili varmış gibi konuşuyor

- **Ciddiyet:** Orta
- **Nerede:** `src/modules/personalization/application/services/ChatService.js:21`

**Tekrar adımları**
1. Giriş yapmadan Asistan sekmesine gidin.
2. "Niacinamide nedir?" diye sorun.

**Beklenen:** Genel bilgi; profil olmadığı belirtilmeli.
**Gerçekleşen:** Yanıt "... **Normal cilt tipine sahip olduğunuz ve alerjiniz olmadığı için** niacinamide..." diye devam ediyor. Kullanıcı hiç profil girmemişken ona ait bir cilt tipi ve "alerjisi yok" bilgisi uydurulup söyleniyor.

**Kök neden:** Oturumsuz istekte `safeProfile` sabit `{ skinType: "normal", conditions: [], allergicIngredients: [] }` olarak AI'ya gönderiliyor; AI bunu kullanıcının gerçek profili sanıyor.

**Etki:** Kozmetik/sağlık yakını bir üründe yanlış kişiselleştirme iddiası. Alerjisi olan bir kullanıcı "alerjiniz yok" cümlesine güvenebilir.

**Önerilen çözüm:** Profil yoksa `safeProfile` gönderme (veya `hasProfile: false` ile birlikte gönder) ve sistem komutunda "kullanıcının kayıtlı profili yok, genel bilgi ver ve profil oluşturmasını öner" talimatı ver.

---

## O-04 — Paylaşım (Story) kartı uydurma veri gösteriyor

- **Ciddiyet:** Orta
- **Nerede:** `public/js/views/ProfileWizardView.js:198-207`

**Tekrar adımları**
1. Dijital dolaba süresi geçmiş bir ürün ekleyin (örn. açılış 01.01.2026, PAO 3 ay).
2. Profil → **✨ Story Kartı Paylaş**.
3. Karttaki sayılara bakın.

**Beklenen:** Gerçek dolap verisi.
**Gerçekleşen:** Kart "**92 / 100 PUAN — Cilt Bakım Çantası Güvenlik Skoru**", "**4 Taze**" ve "✅ **0 Süresi Geçmiş Ürün - Kusursuz Hijyen**" diyor. Gerçek değerler: güvenlik skoru **65**, taze ürün **0**, süresi geçmiş **1**. Değerler kodda sabit yazılmış (`safetyScore: 92, freshCount: 4, expiredCount: 0`).

Ayrıca cilt tipi rozetinde Türkçe yerine **"DRY"** yazıyor.

**Etki:** Bu kart sosyal medyada paylaşılmak için üretiliyor — uygulama kullanıcı adına yanlış bilgi yayıyor.

**Önerilen çözüm:** `GET /personalization/vanity` yanıtındaki gerçek `safetyScore`, `freshCount`, `expiredCount` değerlerini kullan; cilt tipini Türkçe etikete çevir.

---

## O-05 — Hata bildirimi hiçbir kullanıcıya bağlanmıyor; vadedilen 20 puan hiç verilemiyor

- **Ciddiyet:** Orta
- **Nerede:** `POST /api/v1/community/report-issue`

**Tekrar adımları**
1. Geçerli bir `Authorization: Bearer <jwt>` başlığıyla hata bildirimi gönderin.
2. Yanıttaki `userId` alanına bakın.

**Beklenen:** `userId` dolu olmalı ki onay sonrası 20 puan doğru hesaba yazılsın.
**Gerçekleşen:** `"userId": null`. Rota `authMiddleware` kullanmıyor, dolayısıyla "İçerik düzeltildiğinde hesabınıza 20 İnci yüklenecektir" mesajı karşılıksız.

**Kök neden:** `src/modules/community/presentation/routes/communityRoutes.js:20`.

**Önerilen çözüm:** Rotaya `authMiddleware` ekle.

---

## O-06 — 10 MB üstü görselde ham 500 hatası

- **Ciddiyet:** Orta
- **Nerede:** `POST /api/v1/analyze/ocr` (ve tüm JSON uç noktaları)

**Tekrar adımları**
1. `{"image":"<11 MB'lık metin>","mimeType":"image/jpeg"}` gövdesiyle istek gönderin.

**Beklenen:** `413` ve "Gönderdiğiniz görsel çok büyük" gibi Türkçe bir mesaj.
**Gerçekleşen:** `500 INTERNAL_SERVER_ERROR`, üstelik `correlationId: "unknown"` (gövde ayrıştırma hatası, correlationId middleware'inden önce oluşuyor, yani iz sürülemiyor).

**Kök neden:** `express.json({ limit: "10mb" })` (`src/app.js:20`) sınırı aşınca `entity.too.large` fırlatıyor; `errorHandler` bunu `AppError` saymıyor.

**Önerilen çözüm:** `errorHandler` içinde `err.type === "entity.too.large"` durumunu 413 + Türkçe mesaja çevir; `correlationId` middleware'ini gövde ayrıştırıcıdan önceye al.

---

## O-07 — Sohbet başlığında sabit "Gemini Flash" rozeti

- **Ciddiyet:** Orta (yanlış bilgi)
- **Nerede:** `public/js/views/ChatView.js:34`

**Tekrar adımları**
1. Asistan sekmesini açın, sağ üstteki rozete bakın.
2. `.env` içindeki `AI_VISION_PROVIDER` / `GROQ_CHAT_MODEL` değerleriyle karşılaştırın.

**Beklenen:** Gerçekte kullanılan sağlayıcı veya nötr bir etiket.
**Gerçekleşen:** Her zaman "Gemini Flash" yazıyor; yapılandırma Groq (`openai/gpt-oss-120b`) kullanıyor. Yedek kural tabanlı motora düşüldüğünde de yine "Gemini Flash" yazıyor.

**Önerilen çözüm:** Sabit rozeti nötr bir etiketle değiştir; istenirse yanıttaki `provider` alanından güncelle (API bu alanı zaten dönüyor).

---

## O-08 — Ağ hatası mesajı son kullanıcıya geliştirici diliyle gösteriliyor

- **Ciddiyet:** Orta
- **Nerede:** `public/js/api/apiClient.js:99-104`

**Tekrar adımları**
1. Sunucuya ulaşılamaz durumdayken arama kutusuna iki harften uzun bir şey yazın.

**Beklenen:** "İnternet bağlantınız görünmüyor, lütfen tekrar deneyin."
**Gerçekleşen:** "API sunucusuna ulaşılamadı (http://127.0.0.1:9). Sunucunun çalıştığını ve **js/config.js** içindeki adresin bu cihazdan erişilebilir olduğunu doğrulayın."

**Önerilen çözüm:** Kullanıcıya sade Türkçe mesaj göster, teknik ayrıntıyı `console.warn` ile logla.

---

## O-09 — Sayfa altındaki tıbbi sorumluluk metninin son 82 pikseli alt menünün altında kalıyor

- **Ciddiyet:** Orta
- **Nerede:** `public/css/components.css` (`.app-footer`, `.mobile-bottom-nav`)

**Tekrar adımları**
1. 375×812 mobil görünümde ana sayfayı sonuna kadar kaydırın.
2. Alt bilgiye bakın.

**Beklenen:** Tıbbi uyarı ve telif satırı tamamen okunabilir olmalı.
**Gerçekleşen:** `.app-footer` alt kenarı 830px'te, sabit alt menü 748px'ten başlıyor; son **82 piksel** menünün arkasında kalıyor ve daha fazla kaydırılamıyor. `.app-container` için alt boşluk tanımlı ama `.app-footer` o konteynerin dışında.

**Önerilen çözüm:** `.app-footer` için `padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px))` ekle.

---

## O-10 — Tüm trafik düz HTTP'ye açık (cleartext)

- **Ciddiyet:** Orta (yayında yüksek)
- **Nerede:** `capacitor.config.json` (`server.cleartext: true`, `android.allowMixedContent: true`), `android/app/src/main/AndroidManifest.xml` (`android:usesCleartextTraffic="true"`)

**Beklenen:** Yayın derlemesinde yalnızca HTTPS.
**Gerçekleşen:** Üç ayarın üçü de düz HTTP'ye izin veriyor. JWT ve KVKK m.6 kapsamındaki cilt/sağlık verisi şifresiz ağdan geçebilir. Google Play, cleartext trafiğe izin veren uygulamaları Data Safety incelemesinde sorgular.

**Önerilen çözüm:** API'yi HTTPS'e taşıdıktan sonra üç ayarı da kaldır.

---

## O-11 — `JWT_SECRET` için güvensiz varsayılan

- **Ciddiyet:** Orta
- **Nerede:** `src/core/config/env.js:14`

**Gerçekleşen:** `process.env.JWT_SECRET || "default_dev_secret_replace_in_prod"`. Üretimde değişken unutulursa herkesin bildiği bir anahtarla token imzalanır; saldırgan istediği kullanıcı/rol için JWT üretebilir.

**Önerilen çözüm:** `NODE_ENV=production` iken `JWT_SECRET` yoksa veya varsayılana eşitse uygulama açılışta hata verip kapansın.

---

## O-12 — Swagger dokümantasyonu varsayılan olarak herkese açık

- **Ciddiyet:** Orta
- **Nerede:** `src/core/config/env.js:31`, `src/app.js:38-46`

**Gerçekleşen:** `ENABLE_SWAGGER` açıkça `"false"` yapılmadıkça `/api/v1/docs` üretimde de yayında olur ve tüm uç noktaları (admin dâhil) listeler.

**Önerilen çözüm:** Varsayılanı tersine çevir: üretimde kapalı, geliştirmede açık.

---

## O-13 — Hız sınırı normal kullanım için fazla dar; vekil sunucu arkasında herkesi birlikte kilitler

- **Ciddiyet:** Orta
- **Nerede:** `.env` (`RATE_LIMIT_MAX=100`, pencere 15 dk), `src/core/middlewares/rateLimiter.js`, `src/app.js:77`

**Gerçekleşen:** Tüm `/api/v1` için IP başına 15 dakikada 100 istek. Canlı arama her 250 ms'de bir istek atıyor; birkaç arama + ürün açma + profil + rutin ile bu sınıra normal kullanımda ulaşılabilir (test oturumunda yalnızca gezinirken 100 hakkın yarısından fazlası tüketildi).
Ayrıca `app.set("trust proxy", ...)` tanımlı değil; uygulama bir reverse proxy / load balancer arkasına konulduğunda tüm kullanıcılar tek IP olarak görünür ve biri sınırı doldurunca **herkes** 429 alır.

**Önerilen çözüm:** Okuma uç noktaları için limiti yükselt, `/auth/*` için ayrı ve daha sıkı bir limit tanımla; dağıtımda `trust proxy` ayarını yap.

---

## O-14 — Android yedeklemesi açık (`allowBackup="true"`)

- **Ciddiyet:** Orta
- **Nerede:** `android/app/src/main/AndroidManifest.xml:5`

**Gerçekleşen:** WebView `localStorage`'ındaki JWT ve kullanıcı verisi Google Drive otomatik yedeğine dâhil olur. KVKK m.6 özel nitelikli veri için uygun değil.

**Önerilen çözüm:** `android:allowBackup="false"` veya `dataExtractionRules` ile WebView deposunu yedekten hariç tut.

---

# 4. DÜŞÜK ÖNCELİKLİ BULGULAR

## D-01 — Seçim çipleri klavyeyle kullanılamıyor, dokunma alanı küçük
`ProfileWizardView` içindeki tüm çipler `<div onclick>`; `role`, `tabindex` ve `aria-pressed` yok. Ekran okuyucu bunları buton olarak görmüyor, klavyeyle seçilemiyorlar. Yükseklikleri 36px (Material önerisi 48dp). Diğer butonlar da 40–43px ile sınırın hemen altında.
**Çözüm:** Çipleri `<button type="button" aria-pressed>` yap, min yükseklik 44–48px.

## D-02 — Fotoğraf yükleme butonları odaklanılamıyor
"✨ Ön Yüzü Tanı" ve "🧪 INCI Metnini Çek" birer `<label class="btn">`; erişilebilirlik ağacında buton olarak görünmüyorlar (`read_page` çıktısında hiç yer almadılar).
**Çözüm:** `tabindex="0"` + `role="button"` + Enter/Space tuş desteği.

## D-03 — "Cilt Rutinim" ekranına ürün eklenemiyor
Backend `PUT /api/v1/personalization/routine` ile sabah/akşam ürün listesi kabul ediyor ve `GET` bunu döndürüyor, ancak arayüz `routineData`'yı hiç kullanmıyor; sadece sabit bir 4 adımlık tavsiye listesi gösteriyor. Görev listesindeki "rutine ürün ekle / çıkar / aynı ürünü iki kez ekle" senaryoları arayüzde **hiç mevcut değil**.
**Çözüm:** Ya rutin ürün yönetimi arayüzü eklensin ya da kullanılmayan uç nokta kaldırılsın. *(Yeni özellik olduğu için bu oturumda yapılmadı.)*

## D-04 — Bilinmeyen bir URL'de ham JSON 404
`http://localhost:3000/boyle-bir-sayfa-yok` → tarayıcıda ham `{"success":false,...}` JSON'u görünüyor. Yönlendirme hash tabanlı olduğu için günlük kullanımda karşılaşılmıyor, ancak paylaşılan bir derin bağlantıda kötü görünür.
**Çözüm:** API dışı GET istekleri için `index.html` fallback'i.

## D-05 — Boş sorgu tüm katalogu döndürüyor
`GET /api/v1/products/search?q=` → 10.000 kayıt (`meta.total: 10000`). Arayüz 2 karakterden kısa sorguları engellediği için kullanıcıya yansımıyor ama uç nokta gereksiz yük altında.
**Çözüm:** `q` boşsa 400 dön veya sonucu belirgin biçimde sınırla.

## D-06 — İkinci kez tamamlanan rutinde "+0 İnci kazandınız" mesajı
Sunucu doğru davranıyor (`ALREADY_COMPLETED`, 0 puan) ama arayüz yine de `+${pointsAwarded} İnci kazandınız!` diyor → "+0 İnci kazandınız!".
**Çözüm:** `status === "ALREADY_COMPLETED"` durumunda farklı mesaj göster.

---

# 5. KULLANICI KARARI GEREKTİREN KONULAR

Aşağıdakiler ya mimari/ortam kararı gerektiriyor ya da yeni özellik kapsamına giriyor; bu oturumda **değiştirilmedi**.

1. **MongoDB transaction desteği (Y-07'nin kalıcı çözümü).** Katkı onayı `withTransaction` kullanıyor; standalone MongoDB bunu desteklemiyor. İki seçenek var: (a) üretim veritabanını replica set / MongoDB Atlas yap, (b) transaction kullanmayan bir yedek yol ekle (ACID garantisini kaybeder). Hangisi isteniyor?
2. **Hız sınırı değerleri (O-13).** Limitin kaça çıkarılacağı ve `/auth/*` için ayrı limit istenip istenmediği ürün kararı.
3. **"Cilt Rutinim" ürün yönetimi (D-03).** Backend hazır, arayüz yok. Yeni özellik olduğu için eklenmedi.
4. **Cleartext HTTP ve `allowBackup` (O-10, O-14).** Üretim API'si HTTPS'e taşınmadan kaldırılırsa mevcut test düzeneği (emülatör + yerel sunucu) çalışmaz hâle gelir. Yayın takvimine göre karar verilmeli.
5. **`/api/v1/docs` üretimde açık kalsın mı (O-12).** Varsayılan davranış değiştirilecekse onay gerekiyor.

---

# 6. CAPACITOR / ANDROID RİSKLERİ (çalıştırılarak test edilmedi, kod incelemesi)

Bunlar tarayıcıda doğrulanamaz; kod okunarak çıkarıldı. Emülatör başlatılmadı.

## C-01 — Kamera izni reddedilirse kullanıcı neden anlamıyor (yüksek risk)
`public/js/scanner/CapacitorBarcodeStrategy.js:24-44`: izin reddedildiğinde `throw new Error("Kamera izni verilmedi.")` fırlatılıyor, **ama hemen altındaki kendi `catch` bloğu bunu yutup `null` döndürüyor.** `ScannerService.startLiveCamera` `null` görünce "Barkod okunamadı. Lütfen tekrar deneyin veya barkodu elle girin." diyor.
**Sonuç:** İzni reddeden kullanıcıya izin sorunu olduğu hiç söylenmiyor; tekrar tekrar deneyip vazgeçer.
**Öneri:** İzin hatasını ayırıp yüzeye çıkar ve "Ayarlar'dan kamera iznini açın" yönlendirmesi göster.

## C-02 — "Kalıcı olarak reddet" durumu ele alınmıyor (yüksek risk)
Kullanıcı izni "bir daha sorma" ile reddettiğinde `requestPermissions()` artık diyalog açmaz, doğrudan `denied` döner. Kod bu durumu `granted` değil diye aynı genel hataya çeviriyor; uygulama ayarlarına yönlendirme yok.
**Öneri:** `status.camera === "denied"` durumunda ayrı mesaj + `App` eklentisiyle ayarlara yönlendirme.

## C-03 — Tarama iptali hata gibi gösteriliyor (orta risk)
Kullanıcı ML Kit tarayıcısını geri tuşuyla kapattığında sonuç boş döner ve "Barkod okunamadı" hata mesajı gösterilir. İptal bir hata değil; sessizce kapanmalı.

## C-04 — Cihazda kamera yoksa yine genel mesaj (orta risk)
Manifest'te `android.hardware.camera` `required="false"` olarak işaretli (doğru), ama kamerasız cihazda `scan()` hatası yutulup yine "Barkod okunamadı" deniyor. Kamerasız cihazda tarama butonları gizlenmeli veya devre dışı bırakılmalı.

## C-05 — ML Kit tarayıcı modülü indirilmemişse sessiz başarısızlık (orta risk)
`@capacitor-mlkit/barcode-scanning` Android'de Google Play Services üzerinden indirilen tarayıcı modülünü kullanabiliyor. Kod tabanında `installGoogleBarcodeScannerModule()` veya `isGoogleBarcodeScannerModuleAvailable()` çağrısı **hiç yok**. Modül hazır değilse ya da cihazda Play Services yoksa `scan()` hata verir, hata yutulur, kullanıcı "Barkod okunamadı" görür.
**Öneri:** İlk taramadan önce modül varlığını kontrol edip gerekirse indir, indirme sırasında ilerleme göster.

## C-06 — Var olmayan bir eklenti aranıyor (düşük risk, ölü kod)
`public/js/scanner/CapacitorOcrStrategy.js` `OcrScanner` adlı bir Capacitor eklentisi arıyor; bu eklenti `package.json` bağımlılıklarında **yok**. Her zaman backend Vision yedeğine düşüyor (yani çalışıyor), ama kod yanıltıcı. Ayrıca `OcrScanner.processImage({ image: imageSource })` çağrısı `imageSource` olarak bir `Blob` alıyor — Capacitor köprüsü `Blob` serileştiremez, eklenti bir gün eklenirse bu satır patlar.

## C-07 — `@capacitor/camera` ve `@capacitor/status-bar` bağımlılık olarak var ama hiç kullanılmıyor
Kod tabanında tek bir çağrıları yok. APK boyutunu ve izin beyanlarını gereksiz şişirir; Play Store Data Safety formunda açıklanması gereken izinler doğurabilir.
**Öneri:** Kullanılmayacaklarsa `package.json`'dan çıkar.

---

# 7. TEST EDİLDİ — SORUN BULUNMADI

Aşağıdaki alanlar denendi ve beklendiği gibi çalıştı:

- **İlk açılış:** Sayfa temiz açılıyor, konsolda hata yok, tüm ES modülleri 200 dönüyor, 375px'te yatay taşma yok (`scrollWidth === clientWidth === 375`).
- **Ürün arama:** `nemlendirici`, `güneş kremi`, `CeraVe`, tek harf `a`, yazım hatası `ceraveee`, sonuç vermeyen `zzzzqqqqxxx` — hepsi doğru çalıştı. Türkçe tam metin indeksi (`default_language: turkish`) "güneş kremi" için gerçek güneş kremlerini alaka sırasıyla döndürüyor. Sonuç bulunamadığında açılır listede doğru mesaj çıkıyor. Yarım kelime öneki (`cer` → CeraVe) 3. katmandan besleniyor. Geç dönen eski isteğin yeni sonucun üzerine yazmasına karşı sıra numarası koruması çalışıyor.
- **Ürün detayı / güvenlik skoru:** INCI listesi, EC No 1223/2009 bayrakları ve skor doğru. Örnek: `Aqua, Glycerin, Methylparaben, Propylparaben, Hydroquinone, Parfum, Limonene` → Hydroquinone "Kısıtlı (Ek III)", Limonene hem "Kısıtlı" hem "26 koku alerjeninden biri", parabenler "Ek V izinli koruyucu" olarak doğru etiketlendi.
- **İçerik verisi olmayan ürün:** Sahte skor üretilmiyor; "İçerik Verisi Eksik" rozeti ve açıklayıcı metin gösteriliyor.
- **Barkod uç noktası:** Geçerli (`0018787788059`), alfasayısal (`abc`) ve bulunamayan (`9999999999999`) girdilerde doğru 200/404 ve Türkçe mesaj.
- **Kayıt / giriş / çıkış:** Yeni hesap açma, e-posta doğrulama, çıkış, tekrar giriş sorunsuz. Yanlış parolada 401 ve "Geçersiz e-posta veya parola" (kullanıcı var mı bilgisini sızdırmıyor). Boş form tarayıcı doğrulamasıyla engelleniyor. Aynı e-postayla ikinci kayıt 409 "Bu e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut" döndürüyor.
- **Misafir 401 davranışı:** Giriş gerektiren bir uç noktaya token'sız gidildiğinde kullanıcı "oturum süreniz doldu" denip giriş ekranına **atılmıyor** (apiClient `hadToken` bağlamı doğru çalışıyor). Daha önce giderilmiş olan bu hata geri gelmemiş.
- **Cilt profili kaydı:** Tüm adımlar kaydediliyor, veritabanına doğru normalleştirilmiş biçimde yazılıyor, %100 tamamlamada +30 İnci bonusu bir kez veriliyor (`profileCompletedBonusClaimed`). *(Geri yükleme tarafı Y-04/Y-05'te bozuk.)*
- **Uyumluluk kontrolü:** Paraben alerjisi + egzama profiliyle `Methylparaben, Propylparaben, Sodium Lauryl Sulfate` metni → eşleşen alerjenler `METHYLPARABEN`, `PROPYLPARABEN`; SLS için "Egzama eğilimli cilt bariyerini kurutabilecek... sert madde" uyarısı, skor %0. Alerjen grup eşlemesi (`Parabens` çipi → gerçek INCI adları) doğru çalışıyor.
- **PAO / dijital dolap:** Ürün ekleme, listeleme, süre hesabı (`01.01.2026 + 3 ay` → `EXPIRED`, "Süresi Doldu! (Bakteri Riski)"), dolap güvenlik skoru ve olmayan öğeyi silmede 404 — hepsi doğru.
- **Rutin tamamlama:** Sabah rutini +3 İnci, aynı gün ikinci çağrıda `ALREADY_COMPLETED` ve 0 puan (çift tıklamaya karşı sunucu tarafı korumalı).
- **Oyunlaştırma:** Streak sayacı, 7 incilik görsel dizilim, rütbe rozeti doğru. 7 günden az seride sandık butonu `disabled` — doğru davranış.
- **AI sohbet:** Groq üzerinden Türkçe, konuyla ilgili ve makul yanıt (~2 sn). Boş mesajda 400 ve "Soru metni boş olamaz". Mesaj balonları `textContent` ile basılıyor (XSS'e kapalı — bu dosyada doğru yapılmış).
- **OCR:** Gerçek görselle 2 saniyede yanıt; markayı doğru okudu. Görsel olmayan dosya gönderildiğinde çökmüyor, "Görselden metin veya marka okunamadı" ile zarifçe dönüyor. İstemci tarafı 1200px/JPEG 0.85 küçültme ve EXIF temizleme çalışıyor.
- **Olmayan uç nokta:** `/api/v1/yok-boyle` → 404 ve standart hata şeması, correlationId dolu.
- **Hız sınırı başlıkları:** `X-RateLimit-Limit/Remaining/Reset` standartlara uygun dönüyor.
- **Mobil yerleşim:** 375×812'de yatay kaydırma yok, metinler taşmıyor, kartlar düzgün sarılıyor, alt menü `env(safe-area-inset-bottom)` kullanıyor (çentikli ekran uyumlu). *(Tek istisna O-09.)*

---

# 8. KAPSAM DIŞI KALANLAR

- **Gerçek kozmetik ürün fotoğrafıyla OCR:** Depoda yalnızca uygulama ekran görüntüleri ve maskot görselleri var; gerçek bir ambalaj arka yüzü fotoğrafı yok. "Kutusuz şişe ön yüzü eşleştirme" akışı gerçek bir şişe fotoğrafıyla denenemedi.
- **Canlı kamera / barkod tarayıcı:** Tarayıcı panelinde kamera donanımı yok.
- **Android emülatörü / gerçek cihaz:** Görev gereği başlatılmadı; Capacitor tarafı kod incelemesiyle sınırlı (bölüm 6).
- **E-posta gönderimi:** Projede e-posta servisi entegrasyonu yok; doğrulama ve şifre sıfırlama belirteçleri yalnızca API yanıtıyla dağıtılıyor (bkz. B-02, B-03).
- **iOS:** İncelenmedi.
