# .agents/rules/security.md - Güvenlik ve KVKK/GDPR Kuralları

## 1. Kimlik Doğrulama (AuthN) ve Yetkilendirme (AuthZ)
* **Ayrı Katmanlar:** Kimlik doğrulama (`authenticateToken`) ve yetki kontrolü (`requireRole(['admin', 'moderator'])`) bağımsız middleware olarak işletilir.
* **JWT İlkeleri:**
  * Access token kısa ömürlü (15-60 dk), Refresh token güvenli `httpOnly` çerezde veya veritabanında hashli saklanır.
  * Hassas kullanıcı verileri (cilt hastalıkları, şifre) JWT payload'ına yazılmaz.

## 2. Parola ve Gizli Veri Yönetimi
* **Parola Güvenliği:** Parolalar en az 10 tuzlu (salt rounds) **Bcrypt** veya **Argon2id** ile hashlenir. Düz metin (plaintext) veya çift yönlü şifreleme (AES/DES) ile parola saklamak kesinlikle yasaktır.
* **Gizli Anahtarlar (Secrets Management):**
  * Veritabanı şifreleri, JWT secret anahtarları ve dış API anahtarları asla kaynak koduna yazılamaz (`hardcoded`).
  * `.env` dosyası `.gitignore` içinde olmalıdır.
  * Örnek yapı için her zaman güncel bir `.env.example` dosyası sağlanmalıdır.

## 3. Saldırı Korumaları (AppSec)
* **NoSQL Injection Koruması:** `mongo-sanitize` veya benzeri sanitizer'lar ile `$` ve `.` içeren zararlı sorgu operatörleri `req.body`, `req.query`, `req.params` seviyesinde elenir.
* **Güvenlik Başlıkları:** `helmet` middleware'i ile CSP (Content Security Policy), HSTS, X-Frame-Options, X-Content-Type-Options aktif edilir.
* **CORS:** Geliştirme ortamında kontrollü, canlı ortamda yalnızca belirlenen etki alanlarına (domain) izin verilir (`credentials: true`).
* **Hız Sınırlaması (Rate Limiting):** `express-rate-limit` ile API uç noktalarına IP bazlı kota konulur. Barkod arama ve auth uç noktalarına özel sıkı limit uygulanır.

## 4. KVKK / GDPR ve Veri Gizliliği
* **Özel Nitelikli Sağlık Verisi:** Kullanıcının girdiği cilt rahatsızlıkları (`skin_profile: ['eczema', 'rosacea', 'cystic_acne']`) KVKK Madde 6 kapsamında özel nitelikli kişisel sağlık verisidir.
* **Loglama Yasağı:** Kişisel veriler (e-posta, cilt tipi, parola) konsol veya dosya loglarına asla yazılmaz. Loglarda yalnızca `correlationId` ve maskelenmiş kullanıcı ID (`usr_****123`) kullanılır.
* **Hata Maskeleme:** 500 hatalarında veritabanı yığını (stack trace) veya iç sistem detayları kullanıcıya dönülmez; standart güvenli mesaj ve `correlationId` döndürülür.

## 5. Veritabanı Yetkilendirmesi (Least Privilege)
* Canlı ortamda backend servisi için sınırlandırılmış bir DB kullanıcısı (`inci_api_worker`) kullanılır. Bu kullanıcının `dropDatabase` veya mevzuat sözlüğünü (`ingredients`) toplu silme yetkisi bulunmaz.
