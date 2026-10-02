# =====================================================================
# Merchant AI Connector - Production Dockerfile
# Secure, read-only MCP connector for WooCommerce store data
# =====================================================================

# Stage 1: Build TypeScript source
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

# Copy source files and compile
COPY src ./src
RUN npm run build

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="Merchant AI Connector"
LABEL org.opencontainers.image.description="Secure, private, read-only MCP connector for WooCommerce store data in Agent Studio."
LABEL org.opencontainers.image.version="0.1.1"

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artifacts from builder
COPY --from=builder --chown=node:node /app/dist ./dist

# Security hardening: run as non-root user
USER node

# Health verification: ensures Node and build artifacts are runnable
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "import('./dist/index.js').then(() => process.exit(0)).catch(() => process.exit(1))"

# Speak JSON-RPC over stdio
ENTRYPOINT ["node", "dist/index.js"]
