// tests/frontend/frontendContracts.test.js
// Arayüz sözleşmeleri: kaynak dosyalarda çağrılan yardımcıların gerçekten tanımlı
// olduğunu ve kırılan akışların geri gelmediğini doğrular.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

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

  // show/ensureContainer gibi dahili metotlar da sayilabilir; hepsi tanimli olmali
  for (const tur of cagrilanTurler) {
    assert.ok(
      new RegExp(String.raw`\b${tur}\s*\(`).test(toastSource),
      `toast.${tur}() cagriliyor ama ToastManager icinde tanimli degil`
    );
  }

  assert.ok(cagrilanTurler.has("warning"), "toast.warning kullanimi beklenmeli (gerileme korumasi)");
});
