// tests/frontend/xssEscaping.test.js
// Gerileme testi: arayuz sablonlarina giren kullanici/veritabani metni kacislanmali.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PUBLIC_JS = path.join(__dirname, "..", "..", "public", "js");

function readJs(relativePath) {
  return fs.readFileSync(path.join(PUBLIC_JS, relativePath), "utf-8");
}

test("escapeHtml HTML'e anlam katan tum karakterleri kacislamali", async () => {
  // .js uzantili ES modulu CommonJS paketinde dogrudan import edilemedigi icin
  // gecici bir .mjs kopyasi uzerinden yuklenir.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inci-escape-"));
  const copy = path.join(tmpDir, "escapeHtml.mjs");
  fs.writeFileSync(copy, readJs("utils/escapeHtml.js"));

  try {
    const { escapeHtml, safeUrl } = await import(`file:///${copy.split(path.sep).join("/")}`);

    assert.strictEqual(
      escapeHtml('<img src=x onerror="alert(1)">'),
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
    assert.strictEqual(escapeHtml("Dr. Bronner's"), "Dr. Bronner&#39;s");
    assert.strictEqual(escapeHtml("a & b"), "a &amp; b");
    assert.strictEqual(escapeHtml(null), "");
    assert.strictEqual(escapeHtml(undefined), "");

    // Oznitelik kacisi: `"` kacislanmazsa value="..." icinden cikilabiliyor
    assert.ok(!escapeHtml('" onfocus="alert(1)').includes('"'));

    // URL semalari
    assert.strictEqual(safeUrl("https://ornek.com/a.png"), "https://ornek.com/a.png");
    assert.strictEqual(safeUrl("/assets/a.png"), "/assets/a.png");
    assert.strictEqual(safeUrl("javascript:alert(1)"), "");
    assert.strictEqual(safeUrl("data:text/html;base64,PHNjcmlwdD4="), "");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Kullanici ve veritabani metni basan gorunumler escapeHtml kullanmali", () => {
  const riskliDosyalar = [
    "views/HomeScanView.js",
    "views/AdminView.js",
    "views/ProfileWizardView.js"
  ];

  for (const dosya of riskliDosyalar) {
    const source = readJs(dosya);
    assert.ok(
      source.includes('from "../utils/escapeHtml.js"'),
      `${dosya} escapeHtml yardimcisini iceri aktarmali`
    );
    assert.ok(
      source.includes("escapeHtml("),
      `${dosya} icinde escapeHtml kullanilmali`
    );
  }
});

test("Canli arama acilir listesi sorgu metnini kacislamali", () => {
  const source = readJs("views/HomeScanView.js");

  // Hem "Araniyor: 'q'" hem de "sonuc bulunamadi" mesaji sorguyu sablona gomuyor
  assert.ok(
    source.includes("${escapeHtml(q)}"),
    "Arama sorgusu innerHTML sablonuna kacislanmadan girmemeli"
  );
  assert.ok(
    !/Aranıyor: '\$\{q\}'/.test(source),
    "Ham ${q} kullanimi geri gelmemeli"
  );
});

test("Barkod bulunamadi karti barkodu kacislamali", () => {
  const source = readJs("views/HomeScanView.js");
  assert.ok(
    source.includes("${escapeHtml(barcode)}' Barkodu Henüz Kayıtlı Değil"),
    "Barkod degeri karta kacislanarak yazilmali"
  );
});

test("Yonetici tablolari kullanici alanlarini kacislamali", () => {
  const source = readJs("views/AdminView.js");
  assert.ok(source.includes("escapeHtml(u.email)"), "E-posta kacislanmali");
  assert.ok(source.includes("escapeHtml(u.firstName"), "Ad kacislanmali");
  assert.ok(
    !/\$\{u\.email\}/.test(source),
    "Ham ${u.email} kullanimi geri gelmemeli (depolanmis XSS)"
  );
});

// Ayristirma kontrolu: node --check yalnizca sozdizimi bakar, import cozmez.
test("Degistirilen gorunum dosyalari sozdizimsel olarak gecerli olmali", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inci-views-"));
  try {
    for (const dosya of ["views/HomeScanView.js", "views/AdminView.js", "views/ProfileWizardView.js", "utils/escapeHtml.js"]) {
      const copy = path.join(tmpDir, dosya.replace(/[\\/]/g, "__") + ".mjs");
      fs.writeFileSync(copy, readJs(dosya));
      assert.doesNotThrow(
        () => execFileSync(process.execPath, ["--check", copy], { stdio: "pipe" }),
        `${dosya} sozdizimsel olarak gecersiz`
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
