# CLAUDE.md - INCI Engine Proje Rehberi ve Mimari Kuralları

## 1. Proje Özeti ve Teknoloji Yığını
* **Proje:** INCI Engine / skinbyinci (Kozmetik İçerik Analizi, Güvenlik Skoru ve Cilt Uyumluluk Platformu)
* **Teknoloji Yığını:**
  * **Çalışma Zamanı & Dil:** Node.js (v20+), CommonJS & Modern ES Modules (Frontend)
  * **Web Çerçevesi:** Express.js (v5)
  * **Veritabanı:** MongoDB (v7+ Driver) - `obf` veritabanı (~80.000 kozmetik ürünü yüklü)
  * **Mobil Çatı:** Capacitor (v8) - Android (`app.inci.engine`) ve iOS
  * **Frontend:** Vanilla JS / ES Modules, modern CSS değişkenleri, PWA / WebView uyumlu
  * **Yapay Zeka & OCR:** Google Gemini 2.5 Flash / Groq Vision (`llama-3.2-11b-vision-preview`), kural tabanlı uzman yedek motoru
  * **Test Çatısı:** Node Test Runner (`node --test tests/**/*.test.js`)
  * **Dokümantasyon:** Swagger UI (`/api/v1/docs` veya `/health`)
* **Dil Standardı:** Kod, değişkenler, fonksiyonlar ve arayüzler İngilizce; iş kuralları, commit/PR ve kullanıcı arayüzü Türkçe.

---

## 2. Temel Komutlar (CLI Commands)
* **Geliştirme Sunucusunu Başlatma:** `npm run dev` (veya `npm start`) -> `http://localhost:3000`
* **Testleri Çalıştırma:** `npm test` (Tüm birim ve entegrasyon testleri)
* **Tek Bir Testi Çalıştırma:** `node --test tests/analysis/ocrAnalysis.test.js`
* **Mobil Varlıkları Senkronize Etme:** `npx cap sync android`
* **Android Studio'yu Açma:** `npm run cap:android`

---

## 3. Mimari: Modüler Monolit (Modular Monolith)
Uygulama tek bir deploy edilebilir birim olarak çalışır; mantıksal olarak birbirinden katı sınırlarla izole edilmiş 4 ana modülden oluşur:
1. `src/modules/catalog`: Ürün ve marka kataloğu (MongoDB `products` koleksiyonu).
2. `src/modules/analysis`: INCI kimyasal ayrıştırma, komedojenik/allerjen kuralları ve Vision OCR.
3. `src/modules/personalization`: Cilt profili, rutin takibi (AM/PM), PAO sayacı, AI sohbet asistanı.
4. `src/modules/community`: Kullanıcı katkıları, hata bildirimleri, puan ve oyunlaştırma (gamification).

### Katman Hiyerarşisi
$$\text{Presentation (Controller/Routes)} \longrightarrow \text{Application (Service)} \longrightarrow \text{Domain (Entities/Rules)} \longleftarrow \text{Infrastructure (Repositories/DIP)}$$

### Katı İzolasyon Kuralları
1. **Veri İzolasyonu:** Bir modül başka bir modülün MongoDB koleksiyonuna veya veritabanı modellerine ASLA doğrudan sorgu atamaz (`db.collection` erişimi yasaktır).
2. **İletişim Sınırları:** Modüller arası iletişim YALNIZCA ilgili modülün dışa açtığı **Public Facade / Interface** veya asenkron **İç Olay Veriyolu (`src/core/events/eventBus.js`)** üzerinden yapılır.
3. **Repository Zorunluluğu:** Servisler asla doğrudan MongoDB koleksiyonlarına bağlanamaz, Repository katmanını kullanır.
4. **N+1 Sorgu Yasağı:** Ürün listelemede kimyasalları tek tek getiren döngü sorguları yasaktır.

---

## 4. RESTful API ve Hata Standartları
* **URL Formatı:** Tüm uç noktalar `/api/v1/...` önekiyle başlar, çoğul isimler kullanılır (`/api/v1/products`, `/api/v1/analyze/ocr`).
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

## 5. En Son Durum ve Tamamlanan Özellikler
* **Kutusuz Şişe Analizi (Front-of-Bottle Matching):** Kutusu atılmış kozmetik şişelerinin sadece ön yüzü çekildiğinde Marka ve Ürün Adı algılanır, veritabanındaki 80.000 ürün arasından eşleşme bulunur ve kullanıcıya onay kartı gösterilip doğrudan kimyasal (INCI) analizi açılır.
* **Çoklu Vision Sağlayıcısı:** Gemini 2.5 Flash ve Groq Llama 3.2 Vision (`GROQ_API_KEY`) entegre edilmiştir.
* **Görsel Optimizasyonu:** İstemci tarafında görseller yüklenmeden önce Canvas ile 1200px / JPEG 0.85'e küçültülür (yükleme süresi <300ms).
* **Oyunlaştırma & Rutin:** 7 günlük İstiridye Sandığı, Günlük İnci Serisi (Streak), PAO sayacı, AM/PM rutin takipçisi ve Sosyal Paylaşım Kartı aktiftir.
