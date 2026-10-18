// public/js/services/chatService.js - AI Sohbet Danışmanlığı Servisi (SRP & DIP)
// Gerekçe: Yapay zeka asistanı ile cilt uyumluluk sohbeti ve öneri akışını koordine etmek için.
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";

export class ChatService {
  constructor(client = apiClient) {
    this.client = client;
  }

  async sendMessage({ message, barcode = null, rawIngredients = [], history = [] }) {
    const res = await this.client.post(ENDPOINTS.CHAT, {
      message,
      barcode,
      rawIngredients,
      history
    });
    return res.data;
  }
}

export const chatService = new ChatService();
