// public/js/services/adminService.js - Yönetici Veri Servisi (SRP & DIP)
// Gerekçe: Yönetici paneli için kullanıcı ve tarama logu sorgulamalarını yürütmek için.
import { apiClient } from "../api/apiClient.js";
import { ENDPOINTS } from "../api/endpoints.js";

export class AdminService {
  constructor(client = apiClient) {
    this.client = client;
  }

  async listUsers({ page = 1, limit = 20, search = "" } = {}) {
    let url = `${ENDPOINTS.ADMIN_USERS}?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.client.get(url);
  }

  async listScanLogs({ page = 1, limit = 20 } = {}) {
    return this.client.get(`${ENDPOINTS.ADMIN_SCAN_LOGS}?page=${page}&limit=${limit}`);
  }
}

export const adminService = new AdminService();
