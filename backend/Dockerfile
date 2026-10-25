# ============================================================
# Backend API Gateway Dockerfile
# Node.js 18 with Express, Mongoose, and Multer
# ============================================================

FROM node:18-alpine

# Install git for repo cloning
RUN apk add --no-cache git

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Expose Express port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start server
CMD ["node", "src/index.js"]
