// tests/core/swagger.test.js - Swagger UI Uç Noktası Testi
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");

test("Swagger UI: GET /api/v1/docs/ 200 OK ve HTML döküman dönmeli", async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  t.after(() => {
    server.close();
  });

  // Swagger UI varsayılan olarak /api/v1/docs adresini /api/v1/docs/ adresine 301 yönlendirir, docs/ ise 200 döner
  const res = await fetch(`http://localhost:${port}/api/v1/docs/`);
  assert.strictEqual(res.status, 200);

  const html = await res.text();
  assert.ok(html.includes("swagger-ui"), "Swagger UI HTML sayfası yüklenmelidir.");
  assert.ok(html.includes("INCI Engine API"), "Sayfada INCI Engine API başlığı yer almalıdır.");
});
