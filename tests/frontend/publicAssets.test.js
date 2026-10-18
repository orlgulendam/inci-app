// tests/frontend/publicAssets.test.js - Statik Dosya ve Arayüz Bütünlük Testi
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");

test("Frontend: Statik dosyalar ve SPA mimarisi Express üzerinden servis edilmeli", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  t.after(() => {
    server.close();
  });

  // 1. index.html ana sayfa testi
  const homeRes = await fetch(`http://localhost:${port}/`);
  assert.strictEqual(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes("INCI Engine"), "Ana sayfada INCI Engine başlığı olmalı.");
  assert.ok(homeHtml.includes("Tıbbi Sorumluluk Reddi Beyanı"), "Sayfada tıbbi sorumluluk reddi yer almalı.");

  // 2. CSS Dosyaları testi
  const tokensRes = await fetch(`http://localhost:${port}/css/tokens.css`);
  assert.strictEqual(tokensRes.status, 200);
  const tokensCss = await tokensRes.text();
  assert.ok(tokensCss.includes("--color-primary-500"), "Design tokens değişkenleri bulunmalı.");

  const compRes = await fetch(`http://localhost:${port}/css/components.css`);
  assert.strictEqual(compRes.status, 200);
  const compCss = await compRes.text();
  assert.ok(compCss.includes(".medical-disclaimer-banner"), "Tıbbi uyarı sınıfı CSS içinde tanımlı olmalı.");

  // 3. JS Modülleri testi
  const appJsRes = await fetch(`http://localhost:${port}/js/app.js`);
  assert.strictEqual(appJsRes.status, 200);

  const cardFactoryRes = await fetch(`http://localhost:${port}/js/components/CardFactory.js`);
  assert.strictEqual(cardFactoryRes.status, 200);
  const cardFactoryJs = await cardFactoryRes.text();
  assert.ok(cardFactoryJs.includes("Bu bilgiler tıbbi tavsiye değildir, dermatoloğunuza danışın."), "CardFactory içinde sabit tıbbi uyarı bulunmalı.");
});
