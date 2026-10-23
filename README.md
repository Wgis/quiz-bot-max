# Quiz Bot MAX — MAX-бот викторина «Динамо»

Версия викторины для мессенджера MAX ([max-bot-api-client-ts](https://github.com/max-messenger/max-bot-api-client-ts)). Bun/TypeScript, SQLite (`bun:sqlite`).

Логика повторяет Telegram-версию (`../quiz-bot-tg`): приветствие с картинкой, 7 вопросов по одному сообщению (обновляется на месте), выбор помечается 🔵 без раскрытия правильного ответа, финал отдельным сообщением, админ-команды, экспорт в HTML.

## Быстрый старт

```bash
bun install
cp .env.example .env   # заполнить BOT_TOKEN и ADMIN_IDS
bun start
```

## Запуск через Docker Compose (Dokploy)

```bash
BOT_TOKEN=... docker compose up -d --build
```

База и quiz.json живут в volume `app-data` (`/app/data` в контейнере).

## Команды

- `/start` — начать викторину
- `/stats`, `/users`, `/adminhelp` — для администраторов
