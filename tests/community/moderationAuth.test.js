// tests/community/moderationAuth.test.js
// Gerileme testi: moderasyon ve hata bildirimi uc noktalari kimlik dogrulamasiz acik kalmamali.
const test = require("node:test");
const assert = require("node:assert");

const createCommunityRoutes = require("../../src/modules/community/presentation/routes/communityRoutes");

function collectLayers(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      handlerNames: layer.route.stack.map((s) => s.name || "anonymous")
    }));
}

const controllerStub = {
  submit: function submit() {},
  listPending: function listPending() {},
  approve: function approve() {},
  reject: function reject() {},
  reportIssue: function reportIssue() {}
};

function authMiddlewareStub(req, res, next) { next(); }
function adminMiddlewareStub(req, res, next) { next(); }

test("Moderasyon uc noktalari authMiddleware ve adminMiddleware ile korunmali", () => {
  const router = createCommunityRoutes(controllerStub, authMiddlewareStub, adminMiddlewareStub);
  const routes = collectLayers(router);

  const moderationPaths = [
    "/contributions/pending",
    "/contributions/:id/approve",
    "/contributions/:id/reject"
  ];

  for (const path of moderationPaths) {
    const route = routes.find((r) => r.path === path);
    assert.ok(route, `${path} rotasi tanimli olmali`);
    assert.ok(
      route.handlerNames.includes("authMiddlewareStub"),
      `${path} authMiddleware ile korunmali`
    );
    assert.ok(
      route.handlerNames.includes("adminMiddlewareStub"),
      `${path} adminMiddleware ile korunmali`
    );
  }
});

test("Hata bildirimi uc noktasi authMiddleware ile korunmali (userId icin)", () => {
  const router = createCommunityRoutes(controllerStub, authMiddlewareStub, adminMiddlewareStub);
  const route = collectLayers(router).find((r) => r.path === "/community/report-issue");

  assert.ok(route, "report-issue rotasi tanimli olmali");
  assert.ok(
    route.handlerNames.includes("authMiddlewareStub"),
    "report-issue authMiddleware ile korunmali; aksi halde userId null kalir"
  );
});
