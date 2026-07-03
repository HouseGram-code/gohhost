# syntax=docker/dockerfile:1

# ── 1. Установка зависимостей ────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (а не ci): package-lock.json генерится на Windows и не содержит
# Linux/musl-зависимостей Alpine (@emnapi/* и т.п.). install сам их дотянет.
RUN npm install --no-audit --no-fund

# ── 2. Сборка ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3. Запуск (минимальный образ) ────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Инструменты для автообновления (git pull + docker compose build/up на хосте через docker.sock).
RUN apk add --no-cache bash git docker-cli docker-cli-compose docker-cli-buildx

# Непривилегированный пользователь.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Только то, что нужно для запуска (standalone-сервер).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
