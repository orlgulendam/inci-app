# ADR 0001: Modüler Monolit (Modular Monolith) Mimarisi Tercihi

* **Tarih:** 2026-10-17
* **Durum:** Kabul Edildi (Accepted)
* **Karar Vericiler:** Kıdemli Yazılım Mimarı, Proje Geliştirme Ekibi

---

## 1. Bağlam (Context)
INCI Engine projesi; kozmetik ürün içerik analizi, barkod tarama, kişiselleştirilmiş cilt uyumluluğu ve topluluk katkılarını yöneten bir sistemdir.
Mevcut kod tabanında tek bir `server.js` ve doğrudan script'lerle yönetilen monolitik bir başlangıç yapılmıştır.
Ekip ölçeği başlangıçta küçüktür (1-3 geliştirici) ve ilk etapta 1.000 - 50.000 aktif kullanıcı hedeflenmektedir.

Önümüzde iki ana mimari seçenek bulunmaktaydı:
1. **Mikroservisler (Microservices):** Servislerin ayrı repo/deployment birimlerine bölünmesi.
2. **Dağınık Klasik Monolit (Spaghetti Monolith):** Tüm mantığın tek bir Express uygulamasında katmansız büyümesi.
3. **Modüler Monolit (Modular Monolith):** Tek bir deploy edilebilir yapıda, ancak kod tabanında katı modül sınırları ve katmanlı yapı (`Presentation`, `Application`, `Domain`, `Infrastructure`) olan sistem.

---

## 2. Karar (Decision)
**Modüler Monolit (Modular Monolith)** mimarisi seçilmiştir.
Sistem, `src/modules/` altında özellik bazlı dikey dilimlere (`catalog`, `analysis`, `personalization`, `community`) ayrılacak ve her modül kendi içinde 4 katmanlı (Onion/Clean Architecture esintili) bir yapıda geliştirilecektir. Modüller arası doğrudan veritabanı erişimi yasaklanacak, yalnızca public Facade veya Event Bus kullanılacaktır.

---

## 3. Gerekçeler (Rationale)
1. **Düşük DevOps Karmaşıklığı:** Dağıtık mikroservislerin getirdiği ağ gecikmesi, dağıtık transaction (Saga pattern), servis keşfi (service discovery) ve yüksek sunucu maliyetleri küçük bir ekip ve ilk aşama için gereksiz operasyonel yük oluşturur.
2. **Yüksek Geliştirme Hızı:** Tek bir repo (monorepo tarzı tek süreç) ile yerel ortamda çalıştırmak, test etmek ve derlemek çok daha hızlıdır.
3. **Geleceğe Yatırım (Strangler Fig Ready):** Modül sınırları katı korunduğu ve doğrudan DB erişimi engellendiği için, yarın bir modül (örneğin yoğun CPU tüketen `analysis` motoru) ayrı bir mikroservise dönüştürülmek istendiğinde yalnızca ilgili klasör taşınarak ayrıştırılabilecektir.
4. **Veri Bütünlüğü ve Performans:** Modüller aynı süreçte (in-process) çalıştığı için bellek içi metod çağrıları 0 milisaniye gecikmeyle çalışır; ağ üzerinden RPC/HTTP maliyeti oluşmaz.

---

## 4. Sonuçlar (Consequences)
* **Olumlu:**
  * Hızlı geliştirme, kolay yerel hata ayıklama (debugging) ve tek tıkla Docker deployment.
  * Temiz kod, modüller arası sıfır spagetti bağımlılık.
  * Yüksek test edilebilirlik (her modül kendi mock repository'siyle izole test edilebilir).
* **Olumsuz / Dikkat Edilmesi Gerekenler:**
  * Modül sınırlarının zamanla gevşememesi için lint/dependency kontrolleri uygulanmalıdır.
  * Bellek yönetimine dikkat edilmeli, tek bir modüldeki bellek sızıntısının tüm monoliti etkilememesi sağlanmalıdır.
