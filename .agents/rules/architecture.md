# .agents/rules/architecture.md - Mimari Kurallar ve Sınırlar

## 1. Modüler Monolit İlkeleri
1. **Modül Bağımsızlığı:**
   * Sistem, özellik bazlı (feature-based) dikey dilimlere (slices) bölünmüştür:
     - `catalog`: Ürün ve marka yönetimi, arama, filtreleme.
     - `analysis`: INCI kimyasal sözlüğü, AB mevzuat kuralları, güvenlik puanlama motoru.
     - `personalization`: Kullanıcı cilt profilleri, kişisel tolerans ve alerjen uyarıları.
     - `community`: Kullanıcı katkıları (barkod/içerik yükleme), moderasyon, puan sistemi.
   * Her modül `src/modules/<module-name>` altında yer alır.

2. **Döngüsel Bağımlılık Yasağı (No Circular Dependencies):**
   * Modüller arasında döngüsel çağrılar (`A -> B -> A`) yasaktır.
   * Ortak tipler, hatalar ve yardımcı araçlar `src/shared/` katmanında yer alır.

3. **Public Facade / Export Kuralı:**
   * Bir modülün iç dosyalarına (ör. `modules/catalog/src/internal/CatalogRepository.ts`) dış modüllerden `import` yapılamaz.
   * Dış modüller yalnızca `modules/<module-name>/index.ts` veya `modules/<module-name>/public/` üzerinden dışa açılan Facade ve arayüzleri tüketebilir.

4. **Strangler Fig Hazırlığı:**
   * Her modülün veri erişimi, iş kuralları ve HTTP katmanı izole olduğu için gelecekte tek bir komutla bağımsız mikroservise dönüştürülebilir olmalıdır.

---

## 2. Katmanlar Arası İlişkiler (Layer Boundaries)
* **Presentation Layer:** Yalnızca Application katmanındaki Use-Case/Service sınıflarını çağırır. Doğrudan Domain entity'leri değiştiremez, DTO dönüşümü yapar.
* **Application Layer:** İş akışını orkestre eder. Domain entity ve servislerini kullanır. Dış dünya ile Repository arayüzleri üzerinden konuşur.
* **Domain Layer:** En içteki çekirdektir. Hiçbir dış kütüphaneye veya framework'e (Express, MongoDB vb.) bağımlı olamaz (Pure POJO/TypeScript).
* **Infrastructure Layer:** Domain katmanında tanımlanan portları (arayüzleri) uygular. MongoDB sorguları, dış HTTP çağrıları, dosya yüklemeleri burada yaşar.
