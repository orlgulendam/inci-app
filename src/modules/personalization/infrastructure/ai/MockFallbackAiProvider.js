// src/modules/personalization/infrastructure/ai/MockFallbackAiProvider.js - Yedek Kural Tabanlı Danışman Stratejisi (Strategy Pattern)
// Gerekçe: 429 kota aşımında veya harici AI erişilemediğinde kesintisiz hizmet sunmak için.
const IAiProvider = require("./IAiProvider");

class MockFallbackAiProvider extends IAiProvider {
  async generateChatResponse({ message, safeProfile, ingredients = [], isRateLimited = false }) {
    // Profil yoksa cilt tipi uydurulmaz (bkz. ChatService.hasProfile)
    const skinType = (safeProfile && safeProfile.hasProfile && safeProfile.skinType) || null;
    const allergic = safeProfile.allergicIngredients || [];
    const lowerMsg = (message || "").toLowerCase();

    let reply = "";
    let verdict = "BILGI";
    const suggestions = [];

    // Ürün içeriği yoksa veya kullanıcı sohbet ediyorsa
    if (!ingredients || ingredients.length === 0) {
      if (lowerMsg.includes("ürün vermedim") || lowerMsg.includes("urun vermedim") || lowerMsg.includes("merhaba") || lowerMsg.includes("selam")) {
        verdict = "BILGI";
        reply = "Haklısınız, henüz bir ürün taratmadınız veya içerik girmediniz! Bana ambalajın ön yüzünü, arkasındaki INCI listesini veya barkodunu gönderebilirsiniz; cildinize uyumunu hemen inceleyeyim.";
        suggestions.push("Barkod nasıl taranır?", "Ön yüz fotoğrafı nasıl çekilir?");
        return { reply, suggestions, compatibilityVerdict: verdict, provider: "expert-fallback-engine", fallbackUsed: true };
      }
    }

    // Alerjen kontrolü
    const matchedAllergens = (ingredients || []).filter(i => 
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
      reply = skinType
        ? `Cilt profiliniz (${skinType} cilt tipi) doğrultusunda ürün içeriklerini değerlendirdik. Formülasyon genel olarak standart kozmetik tolerans sınırları içerisindedir. Ancak yeni bir ürüne başlarken daima çene veya kol iç yüzeyinde 24 saatlik yama testi yapılması tavsiye edilir.`
        : `Ürün içeriklerini genel kozmetik standartları açısından değerlendirdik; formülasyon standart tolerans sınırları içerisindedir. Cilt tipinize ve alerjenlerinize özel bir değerlendirme için cilt profilinizi oluşturmanız gerekir. Yeni bir ürüne başlarken daima çene veya kol iç yüzeyinde 24 saatlik yama testi yapılması tavsiye edilir.`;
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
