// tests/unit/core.test.js - Core Katmanı Birim ve Healthcheck Testleri
const test = require("node:test");
const assert = require("node:assert/strict");

const { AppError, NotFoundError, ValidationError } = require("../../src/core/errors/AppError");
const eventBus = require("../../src/core/events/eventBus");
const app = require("../../src/app");

test("Core: AppError hiyerarşisi doğru durum kodu ve hata kodu üretmeli", () => {
  const notFound = new NotFoundError("Ürün bulunamadı");
  assert.equal(notFound.statusCode, 404);
  assert.equal(notFound.errorCode, "NOT_FOUND");
  assert.equal(notFound.isOperational, true);

  const validation = new ValidationError("Geçersiz barkod", [{ field: "barcode", error: "8-14 hane olmalı" }]);
  assert.equal(validation.statusCode, 400);
  assert.equal(validation.errorCode, "VALIDATION_ERROR");
  assert.deepEqual(validation.details, [{ field: "barcode", error: "8-14 hane olmalı" }]);
});

test("Core: EventBus Observer deseni olayları doğru iletmeli", (t, done) => {
  eventBus.subscribe("test.ping", (payload) => {
    assert.equal(payload.msg, "pong");
    done();
  });

  eventBus.publish("test.ping", { msg: "pong" });
});

test("Core: HTTP /health uç noktası 200 OK ve standart şema dönmeli", async () => {
  const server = app.listen(3099);
  try {
    const res = await fetch("http://localhost:3099/health");
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, "UP");
    assert.ok(body.data.engine.includes("INCI Engine"));
  } finally {
    server.close();
  }
});

test("Core: Olmayan uç nokta 404 ve standart hata formatı dönmeli", async () => {
  const server = app.listen(3098);
  try {
    const res = await fetch("http://localhost:3098/api/v1/non-existent");
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "NOT_FOUND");
    assert.ok(body.error.correlationId);
  } finally {
    server.close();
  }
});
