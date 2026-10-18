// src/modules/personalization/presentation/controllers/ChatController.js - AI Sohbet Denetleyicisi
class ChatController {
  constructor(chatService) {
    this.chatService = chatService;
  }

  sendMessage = async (req, res, next) => {
    try {
      const userId = req.user ? req.user.sub : null;
      const { message, barcode, rawIngredients, history } = req.body;

      const result = await this.chatService.askAssistant({
        userId,
        message,
        barcode,
        rawIngredients,
        history
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ChatController;
