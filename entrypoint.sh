#!/bin/sh
set -e

# При первом запуске volume /app/data пуст — копируем quiz.json из образа.
# При повторных запусках файл уже на диске — ничего не трогаем.
if [ ! -f /app/data/quiz.json ]; then
    echo "INFO: Initialising quiz.json on data volume..."
    cp /app/defaults/quiz.json /app/data/quiz.json
fi

# exec заменяет shell на bun-процесс, чтобы SIGTERM/SIGINT
# доставлялись прямо в процесс (graceful shutdown работает корректно).
exec bun run /app/src/bot.ts
