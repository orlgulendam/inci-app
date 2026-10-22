// public/js/services/routineService.js - Rutin, Dolap ve Sandık API İstemcisi
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";

export const routineService = {
  // --- RUTİN ---
  async getRoutine() {
    return apiClient.get(ENDPOINTS.ROUTINE);
  },

  async updateRoutine({ morning, evening }) {
    return apiClient.put(ENDPOINTS.ROUTINE, { morning, evening });
  },

  async completeRoutineStep(type) {
    return apiClient.post(ENDPOINTS.ROUTINE_COMPLETE, { type });
  },

  // --- DİJİTAL DOLAP ---
  async getVanity() {
    return apiClient.get(ENDPOINTS.VANITY);
  },

  async addVanityItem({ productId, name, brand, openedAt, paoMonths, notes }) {
    return apiClient.post(ENDPOINTS.VANITY, {
      productId,
      name,
      brand,
      openedAt,
      paoMonths,
      notes
    });
  },

  async removeVanityItem(itemId) {
    return apiClient.delete(ENDPOINTS.VANITY_ITEM(itemId));
  },

  // --- İSTİRİDYE SANDIĞI ---
  async claimOysterChest() {
    return apiClient.post(ENDPOINTS.CHEST_CLAIM, {});
  },

  // --- KİMYASAL ÇAKIŞMA ANALİZİ ---
  async checkConflicts({ ingredientsA, ingredientsB, textA, textB }) {
    return apiClient.post(ENDPOINTS.ANALYZE_CONFLICTS, {
      ingredientsA,
      ingredientsB,
      textA,
      textB
    });
  }
};
