# INCI Engine: Mimari, Veritabanı ve Yazılım Mühendisliği Kavramları Rehberi

> **Kimin İçin?**  
> Bu doküman, 4. sınıf bilgisayar/yazılım mühendisliği öğrencisi perspektifiyle; projede kullanılan tüm teknik terimleri, mimari tercihleri, "neden-sonuç" ilişkilerini ve mülakat/jüri karşısında projeyi bir kıdemli yazılım mimarı gibi savunabilmeniz için gereken tüm kavramları eksiksiz açıklar.

---

## BÖLÜM 1: Büyük Resim — Bu Proje Ne Yapar ve Başlangıçtaki Problem Neydi?

### 1.1. Projenin Çözdüğü Gerçek Hayat Problemi
Bir kozmetik mağazasına (Gratis, Watsons, Sephora) veya eczaneye girdiğinizde, elinize aldığınız bir kremin ya da fondötenin arkasında *"Aqua, Cyclopentasiloxane, Methylparaben, CI 77891, Butylphenyl Methylpropional..."* şeklinde 30 ila 50 arasında Latince/kimyasal terim yazar.
* Sıradan bir tüketicinin bu kimyasallardan hangisinin akneye yol açtığını (komedojenik), hangisinin alerjen olduğunu veya Avrupa Birliği'nde yasaklanmış kanserojen/toksik bir bileşen olup olmadığını bilmesi imkânsızdır.
* **INCI Engine**, kullanıcının barkodu okutmasıyla veya ürün adını yazmasıyla; arka plandaki **Avrupa Birliği Kozmetik Mevzuatı (EC No 1223/2009)** ve **30.000+ maddelik kimyasal sözlükle** ürünü saniyeler içinde eşleştirip;
  * **"Bu ürün temiz içerikli mi?"**
  * **"İçinde kaç tane koku alerjeni var?"**
  * **"Gözenek tıkar mı?"**
  * **"İçindeki maddelerin Türkçe işlevi nedir?"**
  sorularına **50 milisaniyenin altında** net ve bilimsel yanıt veren bir analiz platformudur.

---

### 1.2. Başlangıçtaki Ham Veri Seti Neden Bir "Veri Çöplüğü"ydü?
Projeye başlarken kullanılan açık kaynaklı ham veri seti (Open Beauty Facts - OBF) doğrudan kullanılamayacak kadar dağınık ve kirliydi:
1. **Veri Kirliliği ve Bozuk Kayıtlar:** Bazı ürün isimleri `"123244..."`, `"Micellar water..."`, `"test"` gibi anlamsız metinlerden oluşuyordu. İçerik listeleri bazen boş, bazen de barkod yerine rastgele karakterler içeriyordu.
2. **Çift / Mükerrer Kayıtlar (Duplicate Data):** Aynı barkoda sahip 13 farklı ürün dokümanı bulunuyordu. MongoDB'de tekillik kısıtı (Unique constraint) olmadığı için aynı ürün defalarca farklı şekillerde kaydedilmişti.
3. **Türkiye Pazarı Eksikliği:** Veri seti ağırlıklı olarak Fransa/Avrupa odaklıydı. Türkiye'de en çok satan yerli markalar (*The Purest Solutions, Cream Co, Maruderm, Sinoz, Celenes, Bionnex*) ve eczane dermokozmetikleri (*Bioderma, La Roche-Posay, CeraVe, Avene*) ya hiç yoktu ya da formülleri bozuktu.
4. **Yapısal Düzensizlik:** 80.000 ürünün her birinde içeriklerin güvenlik bayrakları ve toksisite skorları standardize edilmemişti.

---

## BÖLÜM 2: Veritabanını Neye Göre Düzenledik? Temel Kavramlar ve Mimari Kararlar

Veritabanını baştan tasarlarken rastgele kararlar almadık. Her bir mimari tercih, somut bir bilgisayar mühendisliği problemine çözüm olarak geliştirildi:

---

### 2.1. Neden İlişkisel Veritabanı (RDBMS/PostgreSQL) Değil de NoSQL (MongoDB)?
* **İlişkisel Yaklaşım (SQL):** Tablolar, sütunlar ve satırlardan oluşur. Şeması son derece katıdır. Kozmetik ürünlerinde bir sabunda 4 bileşen varken, bir güneş kreminde 45 bileşen olabilir. SQL'de bunu modellemek için:
  * `Products` tablosu,
  * `Ingredients` tablosu,
  * Bu ikisini bağlayan milyonlarca satırlık `Product_Ingredients` ara tablosu (JOIN tablosu) gerekir.
* **Belge Tabanlı NoSQL (MongoDB):** Veriler esnek JSON/BSON dokümanlarında hiyerarşik olarak saklanır.
* **Tercih Gerekçemiz:**
  * **Okuma Hızı (Read Latency):** Kullanıcı mağazada barkodu kameraya tuttuğunda 50-100 ms içinde cevap bekler. SQL'deki gibi 3 tabloyu birbirine bağlamak (`JOIN`) veritabanı motoruna ciddi CPU maliyeti bindirir. MongoDB'de doküman modeli sayesinde analiz özetini tek bir disk okumasıyla anında getirebiliyoruz.
  * **Dinamik Veri Yapısı:** Kozmetik ürünlerinin formülleri, ambalaj boyutları, sertifikaları (Vegan, Cruelty-Free, Helal) değişkendir. Doküman modeli bu esnekliğe doğal uyum sağlar.

---

### 2.2. Gömme (Embedding) vs. Referans Verme (Referencing) — Hibrit Mimari
MongoDB'de verileri birbirine bağlamanın iki yolu vardır:

1. **Referencing (Normalizasyon - SQL mantığı):** Dokümanın içine sadece diğer kaydın kimliğini (`brand_id: ObjectId("...")`) yazarsınız.
2. **Embedding (Denormalizasyon - NoSQL mantığı):** İlgili veriyi doğrudan dokümanın içine alt nesne (sub-document) veya dizi (array) olarak gömersiniz.

#### Projemizde Nasıl Uyguladık? (Hibrit Tasarım)
* **Merkezi Sözlük İçin Referencing:** 30.000+ kimyasal bileşeni bağımsız bir `ingredients` koleksiyonunda topladık. Çünkü bir kimyasal (*örneğin Niacinamide*) binlerce farklı üründe ortak kullanılır. Kimyasalın AB mevzuat durumu değiştiğinde tek bir yerden güncellemek gerekir.
* **Hız İçin Embedding:** Bir kullanıcı ürünü incelediğinde kimyasalların güvenlik durumunu anında görsün diye ürün dokümanının içine şu hafif özeti peşinen gömdük:
  ```json
  "safety_summary": {
    "clean_score": 85,
    "is_clean": true,
    "allergen_count": 0,
    "comedogenic_count": 1,
    "banned_count": 0
  }
  ```
* **Markalar İçin Referencing:** Markanın menşei, resmi web sitesi veya kurumsal adı değişirse 500 ürünün içine tek tek yazmamak için `brands` koleksiyonunu referansladık (`brand_id`).

---

### 2.3. N+1 Sorgu Problemi (N+1 Query Problem) Nedir ve Nasıl Çözüldü?
* **Problem Senaryosu:** Kullanıcı "C Vitamini Serumları" diye arama yaptı ve ekrana 20 ürün geldi:
  1. Sunucu önce 20 ürünü getirmek için veritabanına **1 sorgu** atar.
  2. Eğer ürünlerin içerikleri gömülü değilse, her bir ürünün 30 tane kimyasalını çekmek için döngü içinde 20 kez daha veritabanına sorgu atar (**+20 sorgu**).
  3. Toplamda $1 + 20 = 21$ sorgu (N+1 sorgu) üretilir. Kullanıcı sayısı arttığında veritabanı kilitlenir.
* **Bizim Çözümümüz (Embedded Summary Pattern):** Ürünün içine `safety_summary` ve `ingredients_summary` dizilerini gömdük. Artık 20 ürün listelense bile sistem **yalnızca 1 tek sorgu** ile tüm ürünleri, güvenlik skorlarını ve alerjen bayraklarını eksiksiz çeker. $N+1$ sorgu maliyeti sıfıra indirilmiştir.

---

### 2.4. İndeksleme (Indexing) ve B-Tree Mantığı
* **Kitap Fihristi Analojisi:** 80.000 sayfalık bir kimya ansiklopedisinde "Panthenol" kelimesini aradığınızı varsayın. Eğer fihrist (Index) yoksa, 1. sayfadan 80.000. sayfaya kadar her sayfayı tek tek okumak zorunda kalırsınız. Buna veritabanında **COLLSCAN (Collection Scan / Tüm Tablo Taraması)** denir; CPU tavan yapar ve sistem çöker.  
  İndeks varsa, arkadaki alfabetik fihriste bakıp doğrudan "Sayfa 314"e atlarsınız. Buna **IXSCAN (Index Scan)** denir ve 1 milisaniyeden kısa sürer.
* **Projede Kullandığımız İndeks Türleri:**
  1. **Tekil İndeks (Unique Index - `{ barcode: 1 }`):** Veritabanı motoru düzeyinde aynı barkoddan ikinci bir ürünün kaydedilmesini engeller.
  2. **Bileşik İndeks (Compound Index - `{ brand_id: 1, category: 1 }`):** "L'Oréal markasının Fondötenleri" gibi birden fazla filtre içeren aramaların B-Tree ağacında anında bulunmasını sağlar.
  3. **Metin İndeksi (Full-Text Index - `{ name: "text", brand_name: "text" }`):** Kullanıcı arama kutusuna "kapatıcı", "nemlendirici krem" yazdığında kelime köklerini analiz eden tam metin araması sunar.
  4. **TTL İndeksi (Time-To-Live - `{ scanned_at: 1 }, { expireAfterSeconds: 7776000 }`):** `scan_logs` (kullanıcı tarama geçmişi) koleksiyonundaki kayıtların 90 gün sonra MongoDB tarafından otomatik olarak diskten silinmesini sağlar; sunucu diski dolmaz.

---

### 2.5. JSON Schema Validation (Veri Bütünlüğü Kısıtları)
* **Kavram:** MongoDB doğası gereği "şemasız"dır (schemaless). Bir geliştirici yanlışlıkla barkod alanına harf yazsa veya ürün adını boş geçse dahi Mongo varsayılan olarak bunu kaydeder. Bu durum zamanla kurumsal veritabanlarını çöplüğe çevirir.
* **Biz Ne Yaptık?** MongoDB'nin yerel `$jsonSchema` mekanizmasını kullanarak veritabanı kapısına katı bir bekçi koyduk:
  * `barcode`: `string` tipinde olmak zorundadır ve regex kuralına uygun olmalıdır (8-14 hane).
  * `name`: Zorunlu alandır, boş bırakılamaz (`minLength: 2`).
  * `status`: Sadece `"draft"`, `"published"` veya `"archived"` enum değerlerini alabilir.
  * Hatalı veya kurala uymayan bir doküman eklenmeye çalışıldığında MongoDB işlemi anında reddeder.

---

### 2.6. Multi-Document ACID Transactions (Çoklu Doküman İşlem Güvenliği)
* **Banka Örneği (Atomicity):** Ali'nin hesabından 100 TL düşüldükten sonra sunucu çökerse ve para Veli'nin hesabına geçmezse ne olur? Para buharlaşır. **ACID (Atomicity, Consistency, Isolation, Durability)** kuralı, birbiriyle ilişkili adımları tek bir işlem paketi haline getirir: **"Ya hepsi başarılı olur ya da hiçbiri olmamış gibi geri alınır (Rollback)."**
* **Bizim Projedeki Yeri (Kullanıcı Katkı Mekanizması):**
  Bir kullanıcı veritabanında olmayan yeni bir ürünün fotoğrafını ve barkodunu sisteme yükleyip admin bunu onayladığında:
  1. `product_contributions` dokümanının durumu `"approved"` yapılır.
  2. Yeni ürün `products` koleksiyonuna yazılır.
  3. Katkıyı yapan kullanıcının `reputation_points` değeri 50 artırılır.
  * Bu 3 işlem tek bir MongoDB `session` (Transaction) içinde işletilir. Ürün kataloğa eklenirken hata çıkarsa, kullanıcıya haksız puan verilmez ve işlem geri alınır.

---

### 2.7. Güvenlik, RBAC ve KVKK/GDPR Uyumluluğu
* **RBAC (Role-Based Access Control - Rol Tabanlı Erişim):** En az yetki ilkesi (Principle of Least Privilege) gereğince:
  * Backend uygulaması için `inci_api_service` kullanıcısı oluşturulmuştur. Bu kullanıcı ürün ve log yazabilir, ancak 30.000 maddelik resmi AB mevzuat sözlüğünü (`ingredients`) **asla silemez**.
  * Raporlama servisleri için salt-okunur (`readOnly`) kullanıcı tanımlanmıştır.
* **NoSQL Injection Koruması:** Kullanıcı arama kutusuna `{"$gt": ""}` yazarak veritabanındaki tüm kullanıcıları sızdırmasın diye girdi temizleme (sanitization) katmanı planlanmıştır.
* **KVKK / GDPR Kapsamı:** Kullanıcının kaydettiği cilt tipi (akne, roza, alerji) KVKK Madde 6 kapsamında **Özel Nitelikli Kişisel Sağlık Verisi**dir. Bu veriler TLS ile aktarılır, kullanıcı parolaları ise asla düz metin tutulmaz; tek yönlü kriptografik özet fonksiyonu olan **Bcrypt / Argon2** ile hashlenerek saklanır.

---

## BÖLÜM 3: Uygulama Adımları ve Kod Haritası

| Dosya / Bileşen | Ne Yaptı? (Mühendislik Fonksiyonu) |
| :--- | :--- |
| **[`scripts/scrape-turkish-brands.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/scrape-turkish-brands.js)** | **ETL Pipeline (Extract-Transform-Load):** The Purest Solutions, Cream Co ve Celenes için Shopify JSON API'sine (`/products.json`); Maruderm ve Sinoz için Next.js `sitemap.xml` haritalarına bağlanıp, ürün sayfalarındaki `application/ld+json` etiketlerinden gerçek **868/869 EAN barkodlarını** ve HTML sekmelerinden orijinal laboratuvar INCI listelerini çeken bot. |
| **[`scripts/import-cult-makeup.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/import-cult-makeup.js)** | Gratis, Watsons ve Sephora'da en çok satan 31 kült ten/makyaj ürününü (Maybelline Age Rewind & Fit Me, L'Oréal Infaillible, Pastel Show Your Joy Likit Allık, Rare Beauty vb.) 100% doğrulanmış içerikleriyle veritabanına ekleyen modül. |
| **[`scripts/import-top-dermocosmetics.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/import-top-dermocosmetics.js)** | OBF veri setindeki bozuk/eksik eczane kayıtlarını (Bioderma Sensibio, La Roche-Posay Effaclar, CeraVe Nemlendirici, Avene vb.) resmi laboratuvar formülasyonlarıyla güncelleyen script (Clean Data Overwrite). |
| **[`scripts/migrate-architecture.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/migrate-architecture.js)** | **Ana Mimari Göç Motoru:** Çift barkodları temizledi, 6 ana koleksiyonu (`products`, `ingredients`, `brands`, `users`, `product_contributions`, `scan_logs`) oluşturdu, JSON Schema validator'ları bağladı ve tüm B-Tree indekslerini inşa etti. |
| **[`scripts/analyze-product.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/analyze-product.js)** | **Kural Motoru (Rule Engine):** Virgülle ayrılmış ham içerik metinlerini tokenize eder, parantez içi açıklamaları temizler, 30.000 maddelik AB CosIng sözlüğüyle normalize edip eşleştirir ve güvenlik skorunu hesaplar. |
| **[`server.js`](file:///c:/Users/Gülendam/Desktop/inci-app/server.js)** | Express.js tabanlı RESTful API. `/api/products/search`, `/api/products/:barcode` ve `/api/analyze` uç noktalarını sunar. |

---

## BÖLÜM 4: Jüri, Hoca ve Teknik Mülakat Savunma Rehberi (Soru - Cevap)

### Soru 1: "Neden PostgreSQL gibi ilişkisel bir veritabanı yerine MongoDB seçtin?"
> **Cevap:** *"Hocam, kozmetik formülleri sabit sütunlu yapılar değildir; bir üründe 3 kimyasal varken diğerinde 45 kimyasal olabilir. İlişkisel bir veritabanında bir ürünün analizini çekmek için `Products`, `Ingredients` ve aradaki `Product_Ingredients` ara tablosuna `JOIN` atmak gerekir. Tüketici markette kamerayla barkodu okuttuğunda 50-100 milisaniye altında yanıt bekler. Biz MongoDB'nin esnek doküman modeli üzerinde **Embedded Summary Pattern** uyguladık. Ürünün güvenlik skorunu ve içerik bayraklarını doğrudan ürün dokümanına gömdüğümüz için veritabanı tek bir disk okumasıyla (0-1 ms gecikmeyle) tüm analizi getirebiliyor."*

### Soru 2: "NoSQL kullandığında veri tutarsızlığı ve N+1 sorgu problemi nasıl çözüldü?"
> **Cevap:** *"Mimarimizde saf denormalizasyon yerine **Hibrit Model** tercih ettik. 30.000 maddelik resmi AB mevzuat sözlüğünü (`ingredients`) ve marka bilgilerini (`brands`) merkezi koleksiyonlarda referansladık (Referencing). Ancak okuma performansını maksimize etmek için ürünün güvenlik özetini (`safety_summary`) ürün içine gömdük (Embedding). N+1 problemini de bu gömülü özet sayesinde çözdük; liste ekranında 20 ürün çekildiğinde kimyasallar için tekrar tekrar sorgu atılmaz, tek bir sorguyla tüm ekran dolar."*

### Soru 3: "MongoDB şemasızdır (schemaless). Veri kirliliğini nasıl engellediniz?"
> **Cevap:** *"MongoDB varsayılan olarak şemasız olsa da, kurumsal mimaride veritabanı başıboş bırakılamaz. Biz MongoDB 7'nin yerel **JSON Schema Validation (`$jsonSchema`)** motorunu devreye aldık. Barkodun formatını (8-14 haneli regex), ürün adının uzunluğunu ve ürün durumunun enum değerlerini veritabanı katmanında zorunlu kıldık. Böylece kod katmanında bir hata olsa dahi veritabanı kurallara uymayan veriyi içeri almaz."*

### Soru 4: "Veritabanında 80.000 ürün var. Sistem arama yaparken kilitlenmez mi?"
> **Cevap:** *"Kesinlikle kilitlenmez, çünkü sorgu desenlerimize uygun B-Tree indeksler tasarladık. Barkod için tekil indeks (`unique: true`), marka ve kategori filtreleri için bileşik indeks (`Compound Index: brand_id + category`), ürün aramaları için ise tam metin indeksi (`Full-Text Index`) oluşturduk. `explain('executionStats')` ile yaptığımız ölçümlerde sorguların `COLLSCAN` (tüm koleksiyonu tarama) yapmadığını, doğrudan `IXSCAN` (indeks üzerinden) çalışarak milisaniyeler içinde sonuç verdiğini doğruladık."*

### Soru 5: "AB Kozmetik Mevzuatında bir madde yasaklanırsa 80.000 ürünü nasıl güncelleyeceksiniz?"
> **Cevap:** *"Merkezi `ingredients` koleksiyonumuz olduğu için mevzuat uzmanı ilgili kimyasalın `flags.is_banned` değerini `true` yapar. Sistem arka planda çalışan asenkron bir kuyruk (Worker/Event Bus) aracılığıyla bu kimyasalın `_id`'sini içeren ürünlerin `safety_summary` alanlarını kademeli olarak günceller. Kullanıcı canlıda kesinti hissetmez."*
