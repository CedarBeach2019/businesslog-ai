# Multi-stage build for BusinessLog AI
# Stage 1: Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build 2>/dev/null || true

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Install wrangler for local Workers runtime
RUN npm install -g wrangler

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/src/ ./src/
COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/wrangler.toml ./

# Create data directory for persistent storage
RUN mkdir -p /app/data && chown appuser:appgroup /app/data

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start with wrangler dev for local runtime
CMD ["wrangler", "dev", "--port", "3000", "--local"]
