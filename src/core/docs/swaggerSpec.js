// src/core/docs/swaggerSpec.js - OpenAPI 3.0.3 Dökümantasyon Spesifikasyonu
const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "INCI Engine API",
    version: "1.0.0",
    description: "Kozmetik İçerik Analizi, Cilt Uyumluluğu ve AI Destekli Dermokozmetik Danışmanlık Platformu REST API.",
    contact: {
      name: "INCI Engine Team",
      url: "https://inci.app"
    }
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1 Sunucusu"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Bearer <token> formatında JWT token sağlayın."
      }
    },
    schemas: {
      StandardError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Geçersiz veri girdisi." },
              correlationId: { type: "string", example: "req-c8d7e6f5" },
              details: { type: "array", items: { type: "object" }, nullable: true }
            }
          }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "kullanici@inci.app" },
          password: { type: "string", format: "password", example: "Parola123!" },
          firstName: { type: "string", example: "Gülendam" },
          lastName: { type: "string", example: "Yılmaz" }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "kullanici@inci.app" },
          password: { type: "string", format: "password", example: "Parola123!" }
        }
      },
      SkinProfileDto: {
        type: "object",
        properties: {
          skinType: { type: "string", enum: ["kuru", "yagli", "karma", "normal", "hassas"], example: "karma" },
          conditions: { type: "array", items: { type: "string" }, example: ["akne", "rosea"] },
          allergicIngredients: { type: "array", items: { type: "string" }, example: ["Fragrance", "Parabens"] },
          frequentlyUsedProducts: { type: "array", items: { type: "string" }, example: ["CeraVe Nemlendirici"] },
          routineMedications: { type: "array", items: { type: "string" }, example: ["Retinoid Krem 0.05%"] },
          dermatologistNotes: { type: "string", example: "Günde 2 kez nemlendirici bariyer kremi önerildi." },
          targetedBenefits: { type: "array", items: { type: "string" }, example: ["nemlendirme", "akne karşıtı"] },
          firstName: { type: "string", example: "Gülendam" },
          lastName: { type: "string", example: "Yılmaz" }
        }
      },
      AnalyzeRequest: {
        type: "object",
        required: ["ingredientsText"],
        properties: {
          ingredientsText: {
            type: "string",
            example: "Aqua, Glycerin, Niacinamide, Dimethicone, Phenoxyethanol, Fragrance"
          }
        }
      },
      ChatRequest: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", example: "Bu ürün kuru ve hassas cildim için uygun mu?" },
          barcode: { type: "string", example: "8690123456789", nullable: true },
          rawIngredients: {
            type: "array",
            items: { type: "string" },
            example: ["Aqua", "Glycerin", "Niacinamide"]
          },
          history: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string", enum: ["user", "model"] },
                text: { type: "string" }
              }
            }
          }
        }
      }
    }
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Kimlik Doğrulama"],
        summary: "Yeni kullanıcı kaydı oluşturur",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } }
        },
        responses: {
          201: { description: "Kayıt başarılı, doğrulama linki oluşturuldu." },
          400: { description: "Geçersiz girdi", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
          409: { description: "E-posta zaten kayıtlı", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } }
        }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Kimlik Doğrulama"],
        summary: "Kullanıcı girişi yapar ve JWT döner",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
        },
        responses: {
          200: { description: "Giriş başarılı" },
          401: { description: "Geçersiz e-posta veya parola", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } }
        }
      }
    },
    "/auth/verify-email/{token}": {
      get: {
        tags: ["Kimlik Doğrulama"],
        summary: "E-posta doğrulama linkiyle hesabı onaylar",
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: { description: "E-posta doğrulandı" },
          400: { description: "Geçersiz token", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } }
        }
      }
    },
    "/auth/resend-verification": {
      post: {
        tags: ["Kimlik Doğrulama"],
        summary: "Doğrulama e-postasını tekrar gönderir",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", format: "email" } }, required: ["email"] } } }
        },
        responses: {
          200: { description: "Doğrulama linki oluşturuldu" }
        }
      }
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Kimlik Doğrulama"],
        summary: "Şifre sıfırlama linki talebi",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", format: "email" } }, required: ["email"] } } }
        },
        responses: {
          200: { description: "Sıfırlama linki oluşturuldu" }
        }
      }
    },
    "/auth/reset-password": {
      post: {
        tags: ["Kimlik Doğrulama"],
        summary: "Yeni şifreyi tanımlar",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: { type: "string" },
                  newPassword: { type: "string", format: "password" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Şifre başarıyla güncellendi" },
          400: { description: "Geçersiz token veya şifre" }
        }
      }
    },
    "/profile/skin": {
      get: {
        tags: ["Kişiselleştirme"],
        summary: "Giriş yapmış kullanıcının detaylı cilt profilini getirir",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Cilt profili verisi" },
          401: { description: "Yetkisiz erişim" }
        }
      },
      put: {
        tags: ["Kişiselleştirme"],
        summary: "Cilt profilini günceller",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SkinProfileDto" } } }
        },
        responses: {
          200: { description: "Güncellenmiş profil ve tamamlanma yüzdesi" },
          401: { description: "Yetkisiz erişim" }
        }
      }
    },
    "/profile/check-compatibility": {
      post: {
        tags: ["Kişiselleştirme"],
        summary: "Ürünün kullanıcının cilt profiline göre uyumluluğunu test eder",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  barcode: { type: "string", example: "8690123456789" },
                  rawIngredientsText: { type: "string", example: "Aqua, Glycerin, Alcohol Denat" },
                  inlineProfile: { $ref: "#/components/schemas/SkinProfileDto" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Cilt uyumluluk skoru, riskli içerikler ve etiketler" }
        }
      }
    },
    "/analyze": {
      post: {
        tags: ["İçerik Analizi"],
        summary: "Ham INCI metnini kimyasal olarak analiz eder ve güvenlik skoru üretir",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AnalyzeRequest" } } }
        },
        responses: {
          200: { description: "Analiz sonuç özeti, içerik sınıflandırması ve bayraklar" }
        }
      }
    },
    "/products/{barcode}": {
      get: {
        tags: ["Ürün Kataloğu"],
        summary: "Barkoda göre ürün detayını ve analiz edilmiş içerik listesini döner",
        parameters: [
          { name: "barcode", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: { description: "Ürün detayı" },
          404: { description: "Ürün bulunamadı" }
        }
      }
    },
    "/products/search": {
      get: {
        tags: ["Ürün Kataloğu"],
        summary: "Ürün araması yapar (isim, marka)",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } }
        ],
        responses: {
          200: { description: "Ürün listesi ve sayfalama meta verisi" }
        }
      }
    },
    "/brands": {
      get: {
        tags: ["Ürün Kataloğu"],
        summary: "Kayıtlı markaları ve ürün sayılarını listeler",
        responses: {
          200: { description: "Marka listesi" }
        }
      }
    },
    "/chat": {
      post: {
        tags: ["AI Danışman"],
        summary: "Yapay zeka asistanı ile cilt/ürün hakkında sohbet eder (Gemini Flash + Fallback)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ChatRequest" } } }
        },
        responses: {
          200: { description: "Asistan yanıtı, takip soruları ve tıbbi uyarı metni" }
        }
      }
    },
    "/admin/users": {
      get: {
        tags: ["Yönetici (Admin)"],
        summary: "Kayıtlı kullanıcıları listeler ve arama yapar (Admin yetkisi gerektirir)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } }
        ],
        responses: {
          200: { description: "Kullanıcı listesi" },
          403: { description: "Yönetici yetkisi gerekli" }
        }
      }
    },
    "/admin/scan-logs": {
      get: {
        tags: ["Yönetici (Admin)"],
        summary: "Barkod ve içerik tarama kayıtlarını listeler",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Tarama geçmişi kayıtları" },
          403: { description: "Yönetici yetkisi gerekli" }
        }
      }
    },
    "/contributions": {
      post: {
        tags: ["Topluluk"],
        summary: "Yeni ürün katkısı gönderir (Giriş zorunlu)",
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: "Katkı oluşturuldu" },
          401: { description: "Oturum açılmalı" }
        }
      }
    },
    "/contributions/pending": {
      get: {
        tags: ["Topluluk"],
        summary: "Onay bekleyen katkıları listeler",
        responses: {
          200: { description: "Bekleyen katkılar listesi" }
        }
      }
    },
    "/contributions/{id}/approve": {
      post: {
        tags: ["Topluluk"],
        summary: "Katkıyı onaylar (Moderatör/Admin) ve kullanıcıya puan yazar",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: { description: "Katkı onaylandı ve kataloğa eklendi" }
        }
      }
    }
  }
};

module.exports = swaggerSpec;
