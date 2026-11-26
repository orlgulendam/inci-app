// tests/frontend/frontendContracts.test.js
// Arayüz sözleşmeleri: kaynak dosyalarda çağrılan yardımcıların gerçekten tanımlı
// olduğunu ve kırılan akışların geri gelmediğini doğrular.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const PUBLIC_JS = path.join(__dirname, "..", "..", "public", "js");

function readJs(relativePath) {
  return fs.readFileSync(path.join(PUBLIC_JS, relativePath), "utf-8");
}

function listJsFiles(dir = PUBLIC_JS, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listJsFiles(full, acc);
    else if (entry.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

test("Toast: cagrilan her toast.<tur> metodu ToastManager icinde tanimli olmali", () => {
  const toastSource = readJs("components/Toast.js");

  const cagrilanTurler = new Set();
  for (const file of listJsFiles()) {
    const source = fs.readFileSync(file, "utf-8");
    for (const match of source.matchAll(/toast\.([a-zA-Z]+)\s*\(/g)) {
      cagrilanTurler.add(match[1]);
    }
  }

  for (const tur of cagrilanTurler) {
    assert.ok(
      new RegExp(String.raw`\b${tur}\s*\(`).test(toastSource),
      `toast.${tur}() cagriliyor ama ToastManager icinde tanimli degil`
    );
  }

  assert.ok(cagrilanTurler.has("warning"), "toast.warning kullanimi beklenmeli (gerileme korumasi)");
});

test("HomeScanView yonlendirme geri cagrisi ile olusturulmali", () => {
  const appSource = readJs("app.js");
  assert.ok(
    /new HomeScanView\(\s*this\.mainContainer\s*,/.test(appSource),
    "HomeScanView'e onNavigate parametresi verilmeli; aksi halde misafir giris butonu patlar"
  );
});

test("public/js altindaki tum ES modulleri sozdizimsel olarak gecerli olmali", (t) => {
  // Tek bir modulde sozdizimi hatasi olusursa uygulama "Uygulama yukleniyor..."
  // ekraninda takili kaliyor ve hicbir sunucu testi bunu yakalamiyordu.
  // `node --check` yalnizca ayristirma yapar, import'lari cozumlemez; bu yuzden
  // dosyalar gecici bir .mjs kopyasi uzerinden kontrol edilir.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inci-syntax-"));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  for (const file of listJsFiles()) {
    const relative = path.relative(PUBLIC_JS, file);
    const copy = path.join(tmpDir, relative.split(path.sep).join("__") + ".mjs");
    fs.writeFileSync(copy, fs.readFileSync(file));

    assert.doesNotThrow(
      () => execFileSync(process.execPath, ["--check", copy], { stdio: "pipe" }),
      `${relative} sozdizimsel olarak gecersiz`
    );
  }
});
