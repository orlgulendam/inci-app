# INCI Engine: Yeni Özellikler, Rutin ve Oyunlaştırma Rehberi

Bu belge, **INCI Engine** platformuna eklenen 5 temel kullanıcı bağlılığı (retention), cilt bariyeri koruması ve viral büyüme modülünün teknik mimarisini, veri modellerini ve API uç noktalarını belgeler.

---

## 1. Kimyasal Çakışma ve Bariyer Koruma Motoru (Conflict Detector)
Kullanıcıların birbiriyle geçimsiz, asit yüklemesi yapan veya bariyeri tahrip eden etken maddeleri eşzamanlı kullanmasını engeller.

* **Domain Motoru:** `src/modules/analysis/domain/services/IngredientConflictEngine.js`
* **API Uç Noktası:** `POST /api/v1/analyze/conflicts`
* **Desteklenen Çakışma Kuralları:**
  1. **Retinoidler + AHA / BHA Asitler:** Yüksek Bariyer Hasarı (HIGH). Farklı zamanlarda veya "Skin Cycling" ile kullanım önerisi.
  2. **Retinoidler + Benzoil Peroksit:** Moleküler parçalanma ve aşırı kuruluk (HIGH).
  3. **Saf C Vitamini (L-Ascorbic Acid) + AHA / BHA:** Düşük pH asit yüklemesi ve yanma riski (MEDIUM).
  4. **Bakır Peptitleri + Asitler / Saf C Vitamini:** Peptit bağlarının hidrolizi (MEDIUM).
  5. **Yüksek Niasinamid + Güçlü Asitler:** Niasin dönüşümü ve geçici flushing/kızarıklık (LOW).

---

## 2. Sabah ve Akşam Cilt Rutini Takibi (Daily Routine Tracker)
Kullanıcının her gün iki kez uygulamaya girerek bakım disiplini kazanmasını sağlar. Herhangi bir saat dayatması yoktur; günün dilediği vaktinde serbestçe işaretlenebilir.

* **API Uç Noktaları:**
  * `GET /api/v1/personalization/routine`: Sabah ve Akşam rutin ürünleri ile bugünkü tamamlanma durumunu döner.
  * `PUT /api/v1/personalization/routine`: Adımları günceller.
  * `POST /api/v1/personalization/routine/complete-step`: `{ type: 'morning' | 'evening' }`
* **Ödül Puanlama Mantığı:**
  * Sabah Rutinini Tamamlama: **+3 İnci**
  * Akşam Rutinini Tamamlama: **+3 İnci**
  * Aynı Gün İkisini de Bitirme Bonusu: **+2 İnci** (Günde toplam +8 İnci!)

---

## 3. Dijital Cilt Bakım Dolabım & PAO / SKT Sayacı (Digital Vanity)
Kozmetik ambalajlarındaki açık kavanoz (PAO - Period After Opening) ömrünü ve son kullanma tarihini takip ederek bozulmuş ürün kaynaklı akne/enfeksiyon riskini önler.

* **API Uç Noktaları:**
  * `GET /api/v1/personalization/vanity`: Dolaptaki ürünler, kalan gün sayısı ve Cilt Çantası Güvenlik Skoru.
  * `POST /api/v1/personalization/vanity`: Ürünü açılış tarihi ve PAO süresi (3M, 6M, 12M, 24M) ile dolaba ekler.
  * `DELETE /api/v1/personalization/vanity/:id`: Ürünü dolaptan kaldırır / bitirdi olarak işaretler.
* **Tazelik Durumları:**
  * `FRESH`: Taze ve güvenli.
  * `EXPIRING_SOON`: Kalan gün $\le 30$ ("Son 30 Gün! Yakında Tüketiniz").
  * `EXPIRED`: Kalan gün $\le 0$ ("Süresi Doldu! Bakteri Üreme Riski").

---

## 4. 7 Günlük "İnci İstiridyesi" Sandığı (Mystery Loot Box)
Kullanıcının günlük serisini (Streak) 7 güne veya katlarına ulaştırmasını ödüllendirir.

* **API Uç Noktası:** `POST /api/v1/personalization/chest/claim`
* **Ödüller:**
  * Sürpriz **+25 ile +50 İnci** sandık bonusu.
  * Özel Rütbe Rozetleri:
    * 7. Gün: *"Haftalık Cilt Disiplini 🦪"*
    * 14. Gün: *"Derin Deniz Kaşifi 🌊"*
    * 21. Gün: *"Işıltılı İnci Kraliçesi 👑"*
* **Arayüz:** CSS tabanlı animasyonlu istiridye açılışı, maskot İnci tepkisi ve haptik titreşim geri bildirimi.

---

## 5. Instagram & TikTok Story Paylaşım Kartı (Social Viral Share Card)
Kullanıcının cilt çantasının temizlik skorunu ve başarı serisini sosyal medyada sergilemesini sağlayan organik viral büyüme aracıdır.

* **Teknoloji:** İstemci tarafında sıfır sunucu yüküyle çalışan HTML5 `<canvas>` motoru (`public/js/components/ShareCardModal.js`).
* **Format:** 1080x1920 piksel (9:16) tam dikey Instagram/TikTok Story uyumu.
* **İçerik:**
  * Cilt Çantası Güvenlik Skoru (Örn: 95/100 Puan)
  * Kullanıcı Cilt Tipi & Streak Gün Sayısı
  * Taze Ürün / Bozulmuş Ürün İstatistikleri
  * Mobil Web Share API (`navigator.share`) veya tek tıkla doğrudan PNG indirme desteği.
