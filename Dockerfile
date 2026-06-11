# Stage 1: Build — installs all deps and compiles TypeScript
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json .
COPY src/ ./src/

RUN npm run build

# Stage 2: Production — only compiled JS + production dependencies
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app/data && chown appuser:appgroup /app/data
USER appuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
