# INCI Engine - Production Dockerfile
FROM node:22-alpine AS base

# Güvenlik ve çalışma dizini
WORKDIR /usr/src/app

# Bağımlılık dosyalarını kopyala ve yükle
COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

# Uygulama kaynak kodlarını ve statik dosyaları kopyala
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY data/ ./data/

# Least Privilege: Root yerine yerleşik non-root 'node' kullanıcısına geç
USER node

# Ortam değişkenleri
ENV NODE_ENV=production
ENV PORT=3000

# Dışa açılan port
EXPOSE 3000

# Docker Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Uygulamayı başlat
CMD ["node", "src/server.js"]
