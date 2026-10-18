// src/modules/personalization/presentation/middlewares/authMiddleware.js - JWT Doğrulama Middleware
const { UnauthorizedError } = require("../../../../core/errors/AppError");

function createAuthMiddleware(authService) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new UnauthorizedError("Oturum açmanız gerekiyor. Lütfen Bearer token ile istek atın."));
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded; // { sub, email, role }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = createAuthMiddleware;
