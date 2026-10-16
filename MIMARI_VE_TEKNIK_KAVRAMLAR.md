# INCI Engine: Mimari, Veritabanı ve Yazılım Mühendisliği Kavramları Rehberi

> **Kimin İçin?**  
> Bu doküman, 4. sınıf bilgisayar/yazılım mühendisliği öğrencisi perspektifiyle; projede kullanılan tüm teknik terimleri, mimari tercihleri, "neden-sonuç" ilişkilerini ve mülakat/jüri karşısında projeyi bir kıdemli mühendis gibi savunabilmeniz için gereken tüm kavramları açıklar.

---

## BÖLÜM 1: Büyük Resim — Bu Proje Ne Yapar?

* **Problem:** Bir markete, eczaneye veya Gratis'e gittiğinizde bir kremin veya kapatıcının arkasında *"Aqua, Cyclopentasiloxane, Methylparaben, CI 77891, Butylphenyl Methylpropional..."* gibi 30-50 tane latince/kimyasal isim yazar. Sıradan bir insanın bu maddelerden hangisinin akne yaptığını, hangisinin koku alerjeni olduğunu veya AB'de yasaklanmış bir madde olup olmadığını bilmesi imkansızdır.
* **Çözüm:** **INCI Engine**, tüketicinin barkodu okuttuğunda veya ürün adını yazdığında; arka plandaki AB Kozmetik Mevzuatı (EC No 1223/2009) ve 30.000+ maddelik kimyasal sözlükle ürünü anında eşleştirip **"Temiz mi? Alerjen var mı? Gözenek tıkar mı? İçindeki maddelerin Türkçe görevi ne?"** sorularına milisaniyeler içinde yanıt veren bir analiz platformudur.

---

## BÖLÜM 2: Temel Kavramlar Sözlüğü (Ne, Neden ve Bu Projede Nasıl Yapıldı?)

### 1. Migration (Veritabanı Göçü / Geçişi) Nedir?
* **Basit Tanım:** Bir yazılım projesinde veritabanının yapısını, tablolarını, koleksiyonlarını veya veri tiplerini mevcut sistemi bozmadan, veri kaybetmeden yeni bir mimari sürüme yükseltme işlemine **Migration (Geçiş)** denir.
* **Neden Yaparız?** Proje ilk başladığında veriler dağınık, tek bir Excel/JSON veya kaba bir koleksiyon halindedir. Zamanla performans, güvenlik ve yeni özellikler için veriyi daha düzenli tablolara bölmek ve şemayı güncellemek gerekir.
* **Biz Bu Projede Ne Yaptık? (`scripts/migrate-architecture.js`):**
  1. Başlangıçta sadece tek ve dağınık bir `products` koleksiyonu vardı.
  2. Bir migration script'i yazarak 30.000+ kimyasalı alıp yepyeni bir **`ingredients`** koleksiyonuna taşıdık.
  3. Markaları ayıklayıp benzersiz bir **`brands`** koleksiyonuna böldük.
  4. Mükerrer (aynı barkoda sahip çift) kayıtları temizledik.
  5. İndeksleri ve şema kurallarını bağlayıp tüm sistemi v1.0'dan kurumsal v2.0 mimarisine geçirdik.

---

### 2. NoSQL ve MongoDB Neden Kullanıldı? (SQL / İlişkisel Veritabanından Farkı Ne?)
* **İlişkisel Veritabanı (RDBMS / PostgreSQL / MySQL):** Tablolardan (Tables), sütunlardan ve satırlardan oluşur. Şeması çok katıdır. Eğer bir ürüne 40 tane içerik ekleyecekseniz `products` tablosu, `ingredients` tablosu ve aralarında binlerce satırlık `product_ingredients` ara tablosu (JOIN tablosu) kurmanız gerekir.
* **Belge Tabanlı NoSQL (MongoDB):** Veriler JSON benzeri esnek BSON dokümanlarında saklanır.
* **Neden MongoDB Tercih Ettik?**
  * Kozmetik ürünlerinin formülleri değişken uzunluktadır (bir sabunda 4 madde varken bir fondötende 45 madde olabilir).
  * Mobil kullanıcı barkodu okuttuğu an saniyenin onda birinde yanıt bekler. SQL'deki gibi 3 ayrı tabloyu birbirine bağlamak (JOIN) yerine, analiz özetini doğrudan ürün dokümanının içine koyarak tek bir hamlede ekrana getirebiliriz.

---

### 3. Gömme (Embedding) vs Referanslama (Referencing) Nedir?
MongoDB'de ilişkileri tasarlarken iki yol vardır:

#### A) Gömme (Embedding / Denormalizasyon)
Bir veriyi ana dokümanın içine bir alt nesne (sub-document) veya dizi (array) olarak koymaktır.
* **Projedeki Örneği:** `products` dokümanının içindeki `ingredients_summary` ve `safety_summary`.
* **Gerekçe:** Bir ürünün içerik listesi ve güvenlik skoru (kaç alerjen var, temiz mi?) sadece o ürünle ilgilidir ve ürünle birlikte okunur. Ayrı bir koleksiyona gitmeye gerek kalmadan tek sorguda gelir.

#### B) Referanslama (Referencing / Normalizasyon)
İki koleksiyonu birbirine `_id` (yabancı anahtar / foreign key mantığıyla) bağlamaktır.
* **Projedeki Örneği:** `products.brand_id -> brands._id`.
* **Gerekçe:** Bir markanın logosu, menşei veya web sitesi değiştiğinde o markaya ait 500 ürünün içine tek tek yazmak yerine, markayı merkezi `brands` tablosunda tutarız.

---

### 4. N+1 Sorgu Problemi Nedir ve Nasıl Çözdük?
* **Problem:** Bir e-ticaret veya analiz uygulamasında 20 tane ürün listelemek istediğinizi düşünün:
  1. Önce 20 ürünü çekmek için **1 sorgu** atarsınız.
  2. Sonra her bir ürünün 30 tane kimyasalını göstermek için her ürün başına ayrı ayrı sorgu atarsınız (**+20 sorgu**).
  3. Toplamda 21 sorgu (N+1) atılır ve sunucu kilitlenir.
* **Bizim Çözümümüz:** **Embedded Summary Pattern (Gömülü Özet Deseni)** kullandık. Ürünün içine kimyasalların özetini (`inci_name`, `is_allergen`, `is_banned`, `primary_function_tr`) peşinen gömdük. Artık 20 ürünü de çekseniz, tek bir barkod da taratsanız sadece **1 tek sorgu** atılır; N+1 problemi tamamen yok edilmiştir.

---

### 5. İndeks (Index) ve B-Tree Mantığı Nedir?
* **Kitap Fihristi Benzetmesi:** 1000 sayfalık bir tıp kitabında "Niasinamid" kelimesini aradığınızı düşünün. Eğer fihrist yoksa 1. sayfadan başlayıp 1000. sayfaya kadar her sayfayı tek tek okursunuz. Buna veritabanında **COLLSCAN (Collection Scan / Tüm Tabloyu Tarama)** denir ve sistemleri çökerten şeydir.
* Fihrist varsa (Index), direkt "N" harfine gider, "Sayfa 412" der ve 1 saniyede açarsınız. Buna **IXSCAN (Index Scan)** denir.
* **Projede Kullandığımız İndeks Türleri:**
  1. **Tekil İndeks (`unique: true`):** `barcode` ve `users.email` üzerinde kullandık. Aynı barkodla veya aynı e-posta ile iki farklı kayıt açılamaz.
  2. **Bileşik İndeks (Compound Index):** `{ brand_id: 1, category: 1 }`. Kullanıcı "La Roche-Posay markasının Serum kategorisindeki ürünlerini getir" dediğinde iki kriteri aynı anda anında süzer.
  3. **Full-Text İndeks (Metin Arama):** `{ product_name: "text", brand_name: "text" }`. Kullanıcı arama kutusuna "kapatıcı", "c vitamini", "nemlendirici" yazdığında kelime köklerini analiz edip anında bulur.
  4. **TTL İndeksi (Time-To-Live / Kendi Kendini İmha Eden İndeks):** `scan_logs` koleksiyonunda `scanned_at` üzerine kuruldu. 90 gün geçen tarama kayıtları MongoDB tarafından arka planda diskten otomatik silinir; sunucu şişmez.

---

### 6. JSON Schema Validator (Şema Doğrulayıcı) Nedir?
* **Efsane:** *"NoSQL şemasızdır, içine ne atarsan kabul eder."*  
* **Gerçek:** Profesyonel mimaride veritabanı başıboş bırakılmaz. Eğer bir yazılımcı yanlışlıkla barkod alanına harf yazar ya da ürün adını boş geçerse veritabanı kirlenir.
* **Biz Ne Yaptık?** MongoDB'nin native `$jsonSchema` özelliğini kullanarak veritabanı kapısına bir "güvenlik görevlisi" koyduk. Artık bir ürün ekleneceğinde:
  * `product_name` alanı `string` olmak zorunda ve boş olamaz.
  * `category` alanı sadece belirlediğimiz enum değerlerinden (`"skincare"`, `"concealer"`, `"foundation"` vb.) biri olabilir.
  * `barcode` girilmişse 8 ile 14 hane arası rakamlardan oluşmak zorundadır.

---

### 7. Multi-Document ACID Transaction Nedir?
* **Banka Örneği:** Ali, Veli'ye 100 TL havale ediyor.
  1. Adım: Ali'nin hesabından 100 TL düşüldü.
  2. Adım: Sunucu çöktü / elektrik kesildi.
  3. Adım: Veli'ye para yatırılamadı. Ne oldu? 100 TL buharlaştı!
* **ACID Kuralı:** Birden fazla işlemi tek bir paket (Transaction) yapar. Ya hepsi başarıyla tamamlanır (Commit) ya da bir tanesi bile hata verirse tüm adımlar sanki hiç yapılmamış gibi geri alınır (Rollback / Atomicity).
* **Bizim Projedeki Yeri:** Kullanıcı yeni bir ürün fotoğrafı ve barkodu yüklediğinde (Katkı Mekanizması):
  * Katkı durumu `"approved"` yapılır,
  * Ürün kataloğa eklenir,
  * Kullanıcıya 50 puan verilir.  
  Bu üç işlem transaction içindedir; biri başarısız olursa ürün onaylanmış sayılmaz ve kullanıcıya haksız puan verilmez.

---

### 8. Web Scraping Nedir ve Verileri Nasıl Çektik?
* **Tanım:** İnternetteki e-ticaret veya marka sitelerinden bir yazılım vasıtasıyla otomatik olarak ürün adı, barkod, fotoğraf ve metin ayıklama sanatıdır.
* **Biz Nasıl Çektik? (`scripts/scrape-turkish-brands.js`):**
  * *The Purest Solutions, Cream Co, Celenes:* Sitelerinin arka planındaki açık Shopify API uç noktalarına (`/products.json`) bağlandık.
  * *Maruderm & Sinoz:* Sitelerin Google botları için hazırladığı `sitemap.xml` haritalarını okuduk, tüm ürün sayfalarına girip `<script type="application/ld+json">` etiketlerinden gerçek **868'li EAN barkodlarını** ve HTML accordion sekmelerinden **laboratuvar INCI listelerini** çekip veritabanına aktardık.

---

### 9. KVKK / GDPR ve Güvenlik Mimarisi
* **Hassas Sağlık Verisi:** Kullanıcının girdiği `skin_profile` (Örn: "Roza hastasıyım", "Akneye meyilliyim", "Şu kimyasala alerjim var") bilgileri KVKK madde 6 kapsamında **Özel Nitelikli Kişisel Sağlık Verisi** statüsündedir.
* **Alınan Güvenlik Önlemleri:**
  1. **Parolalar:** Veritabanında asla düz metin tutulmaz; tek yönlü matematiksel özet olan **Bcrypt / Argon2** ile hashlenir.
  2. **NoSQL Injection Koruması:** Kullanıcının arama kutusuna `$ne: ""` veya `$gt` gibi Mongo komutları enjekte ederek veritabanını boşaltmasını engelleyen `mongo-sanitize` mimarisi kuruldu.
  3. **Least Privilege (En Az Yetki İlkesi):** Backend uygulaması için özel bir veritabanı kullanıcısı (`inci_api_service`) tanımlandı. Bu kullanıcı ürün ve katkı ekleyebilir ama AB mevzuat sözlüğünü (`ingredients`) kesinlikle **silemez**.

---

## BÖLÜM 3: Kod Haritası (Hangi Dosya Ne İşe Yarıyor?)

| Dosya | Görevi ve Sorumluluğu |
| :--- | :--- |
| [`server.js`](file:///c:/Users/Gülendam/Desktop/inci-app/server.js) | Express.js REST API sunucusu. `/api/products/search`, `/api/products/:barcode` ve `/api/analyze` uç noktalarını yönetir. |
| [`scripts/analyze-product.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/analyze-product.js) | Kimyasal ayrıştırma motoru. Virgüllü ham metni böler, parantezleri temizler ve AB CosIng sözlüğüyle eşleştirir. |
| [`scripts/migrate-architecture.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/migrate-architecture.js) | Veritabanını kurumsal mimariye yükselten migration script'i. Koleksiyonları, validator'ları ve indeksleri kurar. |
| [`scripts/scrape-turkish-brands.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/scrape-turkish-brands.js) | The Purest Solutions, Cream Co, Maruderm, Sinoz, Celenes ve Bionnex resmi sitelerinden canlı veri çeken bot. |
| [`scripts/import-top-dermocosmetics.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/import-top-dermocosmetics.js) | Eczane kült ürünlerini (Bioderma, LRP, CeraVe, Avene, Vichy) resmi formülleriyle güncelleyen script. |
| [`scripts/import-cult-makeup.js`](file:///c:/Users/Gülendam/Desktop/inci-app/scripts/import-cult-makeup.js) | Gratis, Watsons ve Sephora kült ten makyajı ürünlerini (Maybelline Age Rewind, Pastel Blush vb.) ekleyen script. |
| [`data/glossary.flagged.json`](file:///c:/Users/Gülendam/Desktop/inci-app/data/glossary.flagged.json) | 30.000+ INCI kimyasalı ve güvenlik bayraklarını içeren resmi kaynak veri dosyası. |

---

## BÖLÜM 4: Jüri, Hoca veya Mülakat Karşısında Gelebilecek Sorular ve Cevaplar

### Soru 1: "Neden MySQL / PostgreSQL gibi bir ilişkisel veritabanı değil de MongoDB seçtin?"
> **Cevap:** *"Hocam, kozmetik ürünlerinin formülleri değişken uzunlukta ve yarı-yapısal verilerdir. Bir üründe 5 kimyasal varken diğerinde 50 kimyasal olabilir. İlişkisel bir veritabanında her ürün analizi için `Products`, `Ingredients` ve aradaki `Product_Ingredients` tablolarına JOIN atmak gerekir. Tüketici markette kamerayla barkodu okuttuğunda 100 milisaniye altında yanıt bekler. MongoDB'nin doküman modeli sayesinde analiz özetini doğrudan ürün dokümanına gömdük (Embedded Summary Pattern). Bu sayede tek bir indeksli okuma işlemiyle (0 ms disk gecikmesiyle) tüm analiz ekrana gelebiliyor."*

### Soru 2: "NoSQL'de ilişkiler ve tutarlılık nasıl sağlanıyor? N+1 problemini nasıl çözdün?"
> **Cevap:** *"Mimarimizde hibrit bir yaklaşım kullandık. 1:N ve N:M ilişkilerde okuma performansını maksimize etmek için kritik güvenlik bayraklarını ürün içine gömdük (Embedding). Ancak kurumsal bilgileri (`brands`) ve 30.000 maddelik mevzuat sözlüğünü (`ingredients`) merkezi koleksiyonlarda referansladık (Referencing). N+1 problemini ise ürünün içine `ingredients_summary` dizisini gömerek çözdük; ürün çekildiği an içeriklerin alerjen ve fonksiyon bilgileri zaten dokümanın içinde hazır geliyor."*

### Soru 3: "Veritabanında 80.000 ürün var. Arama yaparken sistem kilitlenir mi?"
> **Cevap:** *"Hayır kilitlenmez, çünkü tüm sık sorgulanan alanlara B-Tree indeksler uyguladık. Barkod aramaları için `unique: true` indeks, marka ve kategori filtrelemeleri için Compound (Bileşik) indeks ve ürün isimleri için Türkçe morfolojik desteğe sahip Full-Text indeks tanımladık. `explain('executionStats')` analizlerimizde sorguların `COLLSCAN` (tüm tabloyu tarama) yerine doğrudan `IXSCAN` (indeks taraması) yaptığı ve 1-2 doküman inceleyerek milisaniyeler içinde sonuç döndüğü doğrulanmıştır."*

### Soru 4: "AB Kozmetik Mevzuatında bir madde aniden yasaklanırsa ne yapacaksınız?"
> **Cevap:** *"Merkezi `ingredients` koleksiyonumuz olduğu için mevzuat uzmanı ilgili maddenin `flags.is_banned` değerini `true` yapar. Ardından tetiklenen asenkron bir worker, bu maddenin `_id`'sini içeren ürün dokümanlarının gömülü özetlerini arka planda günceller. Kullanıcı trafiği hiçbir zaman kesintiye uğramaz."*
