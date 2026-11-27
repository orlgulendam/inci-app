// tests/core/jwtSecretGuard.test.js
// Gerileme testi: uretimde guvensiz varsayilan JWT anahtariyla acilis engellenmeli.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", "..", "src", "core", "config", "env.js");

function reloadConfig({ nodeEnv, jwtSecret }) {
  const eskiEnv = process.env.NODE_ENV;
  const eskiSecret = process.env.JWT_SECRET;

  process.env.NODE_ENV = nodeEnv;
  if (jwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = jwtSecret;

  delete require.cache[require.resolve(ENV_PATH)];
  try {
    return require(ENV_PATH);
  } finally {
    process.env.NODE_ENV = eskiEnv;
    if (eskiSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = eskiSecret;
    delete require.cache[require.resolve(ENV_PATH)];
  }
}

// Not: JWT_SECRET'i tamamen silmek bu testte mumkun degil; env.js dotenv ile
// depodaki .env dosyasini yukluyor. Bu yuzden guvensiz varsayilan deger acikca
// verilerek ayni kosul olusturulur.
test("Uretimde guvensiz varsayilan JWT anahtariyla acilis engellenmeli", () => {
  assert.throws(
    () => reloadConfig({ nodeEnv: "production", jwtSecret: "default_dev_secret_replace_in_prod" }),
    /JWT_SECRET/,
    "Varsayilan anahtar ile uretimde calisilmamali: saldirgan istedigi rol icin JWT uretebilir"
  );
});

test("Uretimde gercek bir anahtar verildiginde sorunsuz yuklenmeli", () => {
  const config = reloadConfig({ nodeEnv: "production", jwtSecret: "cok-gizli-uretim-anahtari" });
  assert.strictEqual(config.security.jwtSecret, "cok-gizli-uretim-anahtari");
  assert.strictEqual(config.isProduction, true);
});

test("Gelistirme ortaminda varsayilan anahtar calismaya devam etmeli", () => {
  const config = reloadConfig({ nodeEnv: "development", jwtSecret: undefined });
  assert.ok(config.security.jwtSecret, "Gelistirmede varsayilan anahtar kullanilabilir");
  assert.strictEqual(config.isProduction, false);
});
