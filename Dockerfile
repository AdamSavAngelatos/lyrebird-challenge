# NOTE: This Dockerfile has not been tested. Treat it as a starting point only.

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

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
