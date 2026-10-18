// src/modules/personalization/presentation/middlewares/adminMiddleware.js - Admin Yetki Kontrolü
const { ForbiddenError, UnauthorizedError } = require("../../../../core/errors/AppError");

function adminMiddleware(req, res, next) {
  if (!req.user) {
    return next(new UnauthorizedError("Oturum açmanız gerekiyor."));
  }

  if (req.user.role !== "admin") {
    return next(new ForbiddenError("Bu işlem için yönetici (admin) yetkisi gereklidir."));
  }

  next();
}

module.exports = adminMiddleware;
