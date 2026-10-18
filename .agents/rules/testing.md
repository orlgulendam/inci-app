# .agents/rules/testing.md - Test ve Kalite Güvencesi Kuralları

## 1. Test Piramidi ve Kapsam Hedefleri
* **Birim Testleri (Unit Tests):**
  * Her servis ve domain kural motoru için zorunludur.
  * Bağımlılıklar (Repositories, dış servisler) mock'lanır (Dependency Inversion sayesinde sahte implementasyon enjekte edilir).
  * Hedef: Kritik iş mantığı katmanında (özellikle `analysis` motorunda) **%80+ kod kapsamı (coverage)**.
* **Entegrasyon Testleri (Integration Tests):**
  * Kritik API uç noktaları için (`/api/v1/products/search`, `/api/v1/analyze`, `/api/v1/products/:barcode`) Supertest ile test edilir.
  * Test ortamı için izole bir test veritabanı veya bellek içi (in-memory) MongoDB kullanılır.

## 2. Mimari Bağımlılık Doğrulama (Architectural Linting)
* Modüller arası sınırların ihlal edilmediğini (örneğin `catalog` modülünün `personalization` repository'sini doğrudan çağırmadığını) denetleyen bir mimari analiz aracı veya kuralı (ör. `dependency-cruiser` veya eslint boundary rules) çalıştırılır.

## 3. Dayanıklılık ve Sistem Testleri
* **Hata Yakalama Testleri:** Veritabanı kesintisinde veya geçersiz girdide uygulamanın çökmediği, doğru hata kodu ve `correlationId` döndüğü test edilir.
* **Health Check Testi:** `/health` uç noktasının veritabanı bağlantı durumunu ve uptime bilgisini doğru döndürdüğü doğrulanır.
* **Zaman Aşımı ve Tekrar (Timeout & Retry):** Dış API isteklerinde (ör. Shopify botu veya OCR servisi) zaman aşımı ve geri çekilme (exponential backoff) mekanizmaları test edilir.
