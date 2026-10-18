// src/core/middlewares/correlationId.js - İstek İzleme Middleware
const crypto = require("crypto");

function correlationIdMiddleware(req, res, next) {
  const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);
  next();
}

module.exports = correlationIdMiddleware;
