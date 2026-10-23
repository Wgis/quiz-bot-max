# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# Bun исполняет TypeScript напрямую — этап сборки tsc не нужен.
FROM oven/bun:1-alpine AS runtime

WORKDIR /app

# production-зависимости; сам bun уже есть в базовом образе (/usr/local/bin/bun)
COPY --from=deps /app/node_modules/ ./node_modules/

COPY src/ ./src/
COPY tsconfig.json ./

# Статический контент, запечённый в образ:
#   - quiz.json хранится в /app/defaults/ и копируется entrypoint-ом при старте
#   - images/ (feedback, results) — только чтение, изменений не требуют
COPY data/quiz.json ./defaults/quiz.json
COPY images/        ./images/

# Entrypoint-скрипт
COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# Создаём /app/data (для SQLite + runtime-копии quiz.json) до смены пользователя
RUN mkdir -p /app/data && chown -R bun:bun /app

# Запуск от непривилегированного пользователя
USER bun

ENV NODE_ENV=production

# MAX API использует Russian Trusted Root CA (Минцифры) — его нет в наборе CA у bun.
# Бандл лежит в образе и подключается через NODE_EXTRA_CA_CERTS.
COPY certs/max-ca-bundle.pem ./certs/max-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/app/certs/max-ca-bundle.pem

# /app/data монтируется как persistent volume в Dokploy:
#   Path in container: /app/data
VOLUME ["/app/data"]

# HEALTHCHECK: проверяем, что исходники на месте и bun работает
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD bun -e "require('fs').accessSync('/app/src/bot.ts')" || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
