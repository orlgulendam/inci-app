// src/modules/personalization/presentation/controllers/AuthController.js
class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, role } = req.body;
      const result = await this.authService.register({ email, password, firstName, lastName, role });
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

  verifyEmail = async (req, res, next) => {
    try {
      const token = req.params.token || req.query.token || req.body?.token;
      const result = await this.authService.verifyEmail(token);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  resendVerification = async (req, res, next) => {
    try {
      const { email } = req.body;
      const result = await this.authService.resendVerification(email);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req, res, next) => {
    try {
      const { email } = req.body;
      const result = await this.authService.forgotPassword(email);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      const result = await this.authService.resetPassword({ token, newPassword });
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

