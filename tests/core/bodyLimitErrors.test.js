// tests/core/bodyLimitErrors.test.js
// Gerileme testi: govde ayristirma hatalari 500 degil, anlamli kod ve mesajla donmeli.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const app = require("../../src/app");

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

test("10 MB ustu govde 413 PAYLOAD_TOO_LARGE dondurmeli", async (t) => {
  const server = await startServer();
  t.after(() => server.close());
  const port = server.address().port;

  // ~11 MB'lik base64 benzeri govde (telefonla cekilmis islenmemis fotograf)
  const buyukGorsel = "A".repeat(11 * 1024 * 1024);
  const res = await fetch(`http://localhost:${port}/api/v1/analyze/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: buyukGorsel, mimeType: "image/jpeg" })
  });

  assert.strictEqual(res.status, 413, "413 Payload Too Large beklenir (onceden 500 donuyordu)");

  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, "PAYLOAD_TOO_LARGE");
  assert.match(body.error.message, /çok büyük/i, "Kullaniciya Turkce ve anlasilir mesaj donmeli");
  assert.ok(body.error.correlationId, "correlationId bulunmali");
  assert.notStrictEqual(body.error.correlationId, "unknown", "correlationId 'unknown' olmamali");
});

test("Bozuk JSON govdesi 400 INVALID_JSON dondurmeli", async (t) => {
  const server = await startServer();
  t.after(() => server.close());
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bozuk json"
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error.code, "INVALID_JSON");
  assert.notStrictEqual(body.error.correlationId, "unknown");
});
