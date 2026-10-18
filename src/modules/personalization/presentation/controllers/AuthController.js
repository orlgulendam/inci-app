// src/modules/personalization/presentation/controllers/AuthController.js
class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      const { email, password, role } = req.body;
      const result = await this.authService.register({ email, password, role });
      return res.status(201).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login({ email, password });
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AuthController;
