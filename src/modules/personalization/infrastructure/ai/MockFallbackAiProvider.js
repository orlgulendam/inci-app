// src/modules/personalization/infrastructure/ai/MockFallbackAiProvider.js - Yedek Kural Tabanlı Danışman Stratejisi (Strategy Pattern)
// Gerekçe: 429 kota aşımında veya harici AI erişilemediğinde kesintisiz hizmet sunmak için.
const IAiProvider = require("./IAiProvider");

class MockFallbackAiProvider extends IAiProvider {
  async generateChatResponse({ message, safeProfile, ingredients = [], isRateLimited = false }) {
    const skinType = safeProfile.skinType || "karma";
    const allergic = safeProfile.allergicIngredients || [];
    const lowerMsg = (message || "").toLowerCase();

    let reply = "";
    let verdict = "BILGI";
    const suggestions = [];

    // Alerjen kontrolü
    const matchedAllergens = ingredients.filter(i => 
      allergic.some(a => i.toLowerCase().includes(a.toLowerCase()))
    );

    if (matchedAllergens.length > 0) {
      verdict = "UYGUN_DEGIL";
      reply = `Dikkat: Ürün içeriğinde profilinizde belirttiğiniz alerjenlerle eşleşen bileşenler tespit edildi: ${matchedAllergens.join(", ")}. Cildinizde reaksiyon riski oluşturabileceği için bu ürünü kullanmadan önce mutlaka yama (patch) testi yapınız.`;
      suggestions.push("Alerjen içermeyen alternatifler nelerdir?", "Yama testi nasıl uygulanır?");
    } else if (skinType === "kuru" && (lowerMsg.includes("alkol") || lowerMsg.includes("kuruluk") || lowerMsg.includes("nem"))) {
      verdict = "DIKKAT";
      reply = `Kuru cilt profiliniz için ürünün nemlendirici bariyer desteği (seramid, gliserin, hyaluronik asit) sağlaması önemlidir. Kurutucu basit alkol türevlerinden (Alcohol Denat) kaçınmanızı öneririz.`;
      suggestions.push("Kuru ciltler için en iyi nem tutucu içerikler hangileri?", "Bu üründe komedojenik risk var mı?");
    } else if (skinType === "yagli" && (lowerMsg.includes("akne") || lowerMsg.includes("sivilce") || lowerMsg.includes("komedojenik"))) {
      verdict = "UYGUN";
      reply = `Yağlı ve akneye meyilli ciltler için gözenek tıkayıcı ağır yağlar (hindistan cevizi yağı, izopropil miristat) yerine salisilik asit (BHA), niasinamid veya çinko PCA içeren formüller daha uygundur.`;
      suggestions.push("Bu ürün gözeneklerimi tıkar mı?", "Salisilik asit oranı kaç olmalıdır?");
    } else {
      verdict = "BILGI";
      reply = `Cilt profiliniz (${skinType} cilt tipi) doğrultusunda ürün içeriklerini değerlendirdik. Formülasyon genel olarak standart kozmetik tolerans sınırları içerisindedir. Ancak yeni bir ürüne başlarken daima çene veya kol iç yüzeyinde 24 saatlik yama testi yapılması tavsiye edilir.`;
      suggestions.push("Bu ürünün cilt bariyerime etkisi nedir?", "Hangi sıklıkla kullanmalıyım?");
    }

    if (isRateLimited) {
      reply = `[Bilgi: Yapay zeka servisimizdeki anlık yoğunluk nedeniyle uzman dermatolojik kural motorumuz devrededir.]\n\n${reply}`;
    }

    return {
      reply,
      suggestions,
      compatibilityVerdict: verdict,
      provider: "expert-fallback-engine",
      fallbackUsed: true
    };
  }
}

module.exports = MockFallbackAiProvider;
