# GEMINI.md - INCI Engine Temel Proje ve Mimari Kuralları

## 1. Proje Özeti ve Teknoloji Yığını
* **Proje:** INCI Engine (Kozmetik İçerik Analizi ve Cilt Uyumluluk Platformu)
* **Teknoloji Yığını:**
  * **Çalışma Zamanı & Dil:** Node.js (LTS), TypeScript / Modern ES Modules
  * **Web Çerçevesi:** Express.js (v5)
  * **Veritabanı:** MongoDB (v7+ Driver) - Doküman Tabanlı NoSQL
  * **Girdi Doğrulama:** Zod / Joi DTO şemaları
  * **Test Çatısı:** Jest / Supertest
  * **Dokümantasyon:** OpenAPI / Swagger UI (`/api/v1/docs`)
  * **Konteynerizasyon:** Docker & Docker Compose
* **Ölçek Hedefi:** Başlangıçta 1.000 - 50.000 aktif kullanıcı, yüksek okuma (read-heavy, <50ms gecikme) profili.
* **Dil Standardı:** Kod, değişkenler, fonksiyonlar ve arayüzler İngilizce; iş kuralları, commit/PR ve kullanıcı arayüzü Türkçe.

---

## 2. Mimari: Modüler Monolit (Modular Monolith) & Katmanlı Yapı
Uygulama tek bir deploy edilebilir birim (monolith) olarak çalışır ancak mantıksal olarak birbirinden katı sınırlarla izole edilmiş **Modüllerden** oluşur. Her modül gelecekte mikroservise dönüştürülebilecek (Strangler Fig pattern) bağımsızlıkta tasarlanır.

### Modül İçi Katman Hiyerarşisi
Her modül kendi içinde şu 4 katmandan oluşur:
1. **Presentation (Arayüz/Controller):** HTTP isteklerini karşılar, DTO doğrulamasını yapar, uygun HTTP durum kodunu döner.
2. **Application (Use-Case / Servis):** İş akışlarını koordine eder, transaction yönetir, domain ile altyapı arasında köprüdür.
3. **Domain (Varlıklar & Kurallar):** Saf iş kuralları, entity'ler, kural motoru, value object'ler. Dış kütüphanelerden ve veritabanından tamamen bağımsızdır.
4. **Infrastructure (Altyapı/Repository):** Domain katmanında tanımlanan arayüzleri (Interface) uygular. MongoDB sorguları, dış HTTP istekleri, dosya işlemleri bu katmandadır.

### Modül İzolasyon Kuralları
1. **Veri İzolasyonu:** Bir modül başka bir modülün MongoDB koleksiyonuna veya veritabanı modellerine ASLA doğrudan sorgu atamaz (`db.collection` erişimi yasaktır).
2. **İletişim Sınırları:** Modüller arası iletişim YALNIZCA ilgili modülün dışa açtığı **Public Facade / Interface** veya asenkron **İç Olay Veriyolu (Event Bus)** üzerinden yapılır.
3. **Bağımlılık Yönü:** 
   $$\text{Presentation} \longrightarrow \text{Application} \longrightarrow \text{Domain} \longleftarrow \text{Infrastructure (DIP)}$$
   Döngüsel bağımlılık (circular dependency) kesinlikle yasaktır.

---

## 3. SOLID Prensipleri
* **SRP (Single Responsibility):** Her sınıf ve fonksiyon tek bir amaca hizmet eder (Örn: Kontrolcü iş kuralı işletmez, servis HTTP nesnesine dokunmaz).
* **OCP (Open/Closed):** Yeni bir analiz kuralı (Örn: Komedojenik kuralı, Parfüm kuralı) eklendiğinde çekirdek motor kodu değiştirilmez, yeni bir kural stratejisi eklenir.
* **LSP (Liskov Substitution):** Türetilen sınıflar ve interface uygulamaları üst sözleşmenin davranışını bozamaz.
* **ISP (Interface Segregation):** Modüller yalnızca ihtiyaç duydukları fonksiyonları içeren küçük arayüzlere bağımlı olur.
* **DIP (Dependency Inversion):** Üst katmanlar alt katmanların somut sınıflarına değil, soyut arayüzlere (Interface) bağımlıdır. Bağımlılıklar Dependency Injection (Constructor Injection) ile enjekte edilir.

---

## 4. Tasarım Desenleri (Design Patterns)
Süs amaçlı desen kullanımı yasaktır (Over-engineering yapılmaz). Yalnızca gerçek bir mühendislik problemi için kullanılır ve dosya başında **tek satır yorumla gerekçesi yazılır**:
* **Repository:** Veritabanı sorgularını iş mantığından soyutlamak için.
* **Facade:** Bir modülün iç karmaşıklığını gizleyip diğer modüllere temiz bir public API sunmak için.
* **Strategy:** Kozmetik bileşenlerinin farklı regülasyon ve kural setlerine (AB CosIng, FDA, Helal/Vegan, Komedojenik) göre analiz edilmesi için.
* **Observer / Event Bus:** Kullanıcı tarama yaptığında veya yeni katkı onaylandığında modüller arası gevşek bağlı (loose coupling) bildirimler için.
* **Adapter:** Dış veri kaynaklarından (Shopify API, OpenFoodFacts JSON, XML sitemap) gelen verileri sistemin iç veri modeline dönüştürmek için.

---

## 5. RESTful API ve Hata Standartları
* **URL Formatı:** Tüm uç noktalar `/api/v1/...` önekiyle başlar, çoğul isimler kullanılır (`/api/v1/products`, `/api/v1/ingredients`).
* **HTTP Metotları:** GET (okuma), POST (oluşturma), PUT/PATCH (güncelleme), DELETE (silme).
* **HTTP Durum Kodları:** 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests, 500 Internal Error.
* **Standart Yanıt Yapısı:**
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { "page": 1, "limit": 20, "total": 1450 }
  }
  ```
* **Standart Hata Yapısı:**
  ```json
  {
    "success": false,
    "error": {
      "code": "PRODUCT_NOT_FOUND",
      "message": "Belirtilen barkoda ait ürün bulunamadı.",
      "correlationId": "req-c8d7e6f5"
    }
  }
  ```

---

## 6. Veri Yönetimi & Performans Kuralları
1. **Repository Zorunluluğu:** Servisler asla doğrudan MongoDB koleksiyonlarına bağlanamaz, Repository katmanını kullanır.
2. **N+1 Sorgu Yasağı:** Ürün listelemede kimyasalları tek tek getiren döngü sorguları yasaktır; Embedded Summary veya `$in` operatörü kullanılır.
3. **Transaction Güvencesi:** Birden fazla koleksiyonu ilgilendiren kritik işlemlerde (Katkı onaylama, kullanıcı puanı yazma) MongoDB Client Session ile Multi-Document ACID Transaction kullanılır.
4. **İndeks Bilinci:** Her sorgu için B-Tree / Text indeks desteği sağlanır; `COLLSCAN` loglarda tespit edildiğinde derhal indekslenir.

---

## 7. Genel Geliştirme İlkeleri
* **KISS & YAGNI:** En basit çalışan çözüm en iyisidir. İleride gerekebilir diye gereksiz karmaşıklık eklenmez.
* **Küçük Adımlarla İlerleme:** Her adım önce modellenir, kodlanır, birim testi yazılır ve çalıştığı doğrulanır.
* **ADR (Architectural Decision Record):** Kritik mimari tercihler için `docs/adr/` altına gerekçe ve sonuçları içeren kayıt açılır.
