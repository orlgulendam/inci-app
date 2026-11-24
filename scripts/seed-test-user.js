// scripts/seed-test-user.js
// Geliştirme ve manuel test için hazır bir kullanıcı oluşturur:
// e-postası doğrulanmış, cilt profili %100 dolu, böylece kişiselleştirilmiş
// uyumluluk analizi (Seçenek A) doğrudan denenebilir.
//
// SADECE GELİŞTİRME İÇİNDİR. Bu hesap üretim veritabanında oluşturulmamalıdır.
//
// Parola BU DOSYADA TUTULMAZ. Depoya parola gömmemek için:
//   - TEST_USER_PASSWORD ortam değişkeni verilirse o kullanılır,
//   - verilmezse rastgele üretilir.
// Her iki durumda da üretilen bilgiler .test-user.local.json dosyasına yazılır
// ve bu dosya .gitignore ile dışarıda bırakılır.
//
// Kullanım:
//   node scripts/seed-test-user.js            (oluşturur veya yeniden kurar)
//   node scripts/seed-test-user.js --delete   (siler)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { connectToMongo, getDb } = require("../src/core/database/mongo");
const AuthService = require("../src/modules/personalization/application/services/AuthService");
const ProfileService = require("../src/modules/personalization/application/services/ProfileService");
const MongoUserRepository = require("../src/modules/personalization/infrastructure/repositories/MongoUserRepository");
const config = require("../src/core/config/env");

const TEST_EMAIL = process.env.TEST_USER_EMAIL || "test@inci.local";
const TEST_PASSWORD =
  process.env.TEST_USER_PASSWORD || ("Test-" + crypto.randomBytes(6).toString("base64url") + "!1");
const CREDENTIALS_FILE = path.resolve(__dirname, "../.test-user.local.json");

const TEST_PROFILE = {
  skinType: "hassas",
  conditions: ["rosacea", "fragrance_sensitive", "comedogenic_prone"],
  allergicIngredients: ["Parabens", "Fragrance (Parfüm)", "Sulfates (SLS/SLES)"],
  targetedBenefits: ["nemlendirme", "yatistirma", "leke karsiti"],
  frequentlyUsedProducts: ["CeraVe Nemlendirici Krem", "La Roche-Posay Anthelios SPF50"],
  routineMedications: [],
  dermatologistNotes: "Cilt bariyeri zayif; kimyasal peelinglerden kacinilmali, seramid bazli urunler tercih edilmeli."
};

(async () => {
  if (config.isProduction) {
    console.error("Bu betik uretim ortaminda calistirilamaz (NODE_ENV=production).");
    process.exit(1);
  }

  await connectToMongo();
  const users = getDb().collection("users");
  const repo = new MongoUserRepository();

  if (process.argv.includes("--delete")) {
    const res = await users.deleteOne({ email: TEST_EMAIL });
    console.log(res.deletedCount > 0 ? `Silindi: ${TEST_EMAIL}` : `Bulunamadi: ${TEST_EMAIL}`);
    process.exit(0);
  }

  // Varsa temizle, bastan olustur (idempotent)
  await users.deleteOne({ email: TEST_EMAIL });

  const authService = new AuthService(repo);
  const profileService = new ProfileService(repo);

  const registered = await authService.register({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    firstName: "Test",
    lastName: "Kullanici"
  });

  // E-posta dogrulamasini tamamla (gercek posta kutusuna gerek kalmasin)
  await authService.verifyEmail(registered.verificationToken);

  // Cilt profilini doldur
  await profileService.updateSkinProfile(registered.id, TEST_PROFILE);

  // Giris yapip dogrula
  const session = await authService.login({ email: TEST_EMAIL, password: TEST_PASSWORD });
  const saved = await repo.findById(registered.id);

  // Giris bilgilerini yerel, gitignore edilmis dosyaya yaz
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify(
      {
        _not: "Bu dosya .gitignore ile depo disinda tutulur. Yalnizca yerel gelistirme icindir.",
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        createdAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\n=== TEST KULLANICISI HAZIR ===");
  console.log("  e-posta        :", TEST_EMAIL);
  console.log("  parola         : " + CREDENTIALS_FILE + " dosyasinda");
  console.log("  e-posta dogrulandi:", saved.isEmailVerified);
  console.log("  cilt tipi      :", saved.skinProfile.skinType, "(arayuzden 'hassas' gonderildi)");
  console.log("  durumlar       :", saved.skinProfile.conditions.join(", "));
  console.log("  alerjenler     :", saved.skinProfile.allergicIngredients.join(", "));
  console.log("  profil doluluk : %" + saved.skinProfile.completionPercentage);
  console.log("  JWT uretildi   :", Boolean(session.token));

  console.log("\n=== DENEYEBILECEKLERIN ===");
  console.log("  1. Giris yap -> ana ekranda INCI metni yapistir:");
  console.log("     Aqua, Glycerin, Methylparaben, Parfum, Linalool");
  console.log("     -> kisisel alerjen uyarisi ve dusuk uyum skoru gormelisin");
  console.log("  2. Barkod sorgula: 3337875543248  (Vichy Mineral 89)");
  console.log("  3. Isim ara: cerave / la roche posay / clinique");
  console.log("  4. Cikis yapip ayni icerigi dene -> yalnizca genel guvenlik raporu + giris CTA");

  process.exit(0);
})().catch((err) => {
  console.error("HATA:", err.message);
  process.exit(1);
});
