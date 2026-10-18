// public/js/api/endpoints.js - API Uç Noktaları Tanımları
export const ENDPOINTS = {
  // Kimlik Doğrulama
  AUTH_REGISTER: "/api/v1/auth/register",
  AUTH_LOGIN: "/api/v1/auth/login",
  AUTH_VERIFY_EMAIL: (token) => `/api/v1/auth/verify-email/${encodeURIComponent(token)}`,
  AUTH_RESEND_VERIFICATION: "/api/v1/auth/resend-verification",
  AUTH_FORGOT_PASSWORD: "/api/v1/auth/forgot-password",
  AUTH_RESET_PASSWORD: "/api/v1/auth/reset-password",

  // Cilt Profili & Uyumluluk
  PROFILE_SKIN: "/api/v1/profile/skin",
  PROFILE_CHECK_COMPATIBILITY: "/api/v1/profile/check-compatibility",
  PROFILE_DELETE_ACCOUNT: "/api/v1/profile/account",


  // İçerik Analizi & Katalog
  ANALYZE_RAW: "/api/v1/analyze",
  PRODUCT_BY_BARCODE: (barcode) => `/api/v1/products/${encodeURIComponent(barcode)}`,
  PRODUCTS_SEARCH: "/api/v1/products/search",
  BRANDS: "/api/v1/brands",

  // AI Danışmanlık
  CHAT: "/api/v1/chat",

  // Yönetici (Admin)
  ADMIN_USERS: "/api/v1/admin/users",
  ADMIN_SCAN_LOGS: "/api/v1/admin/scan-logs",

  // Sistem
  HEALTH: "/api/v1/health"
};
