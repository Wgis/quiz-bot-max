import 'dotenv/config';
import { Bot, ImageAttachment } from '@maxhub/max-bot-api';
import { initDb, closeDb } from './db/init';
import { loadQuiz, imageExists, readImage } from './services/quiz.service';
import { purgeExpiredSessions } from './services/session.service';
import { registerStartHandler } from './handlers/start.handler';
import { registerQuizHandler } from './handlers/quiz.handler';
import { registerAdminHandler } from './handlers/admin.handler';
import { logger } from './utils/logger';

// ─── Инициализация ─────────────────────────────────────────────────────────────

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN не задан в .env');
  process.exit(1);
}

try {
  loadQuiz();
  logger.info('quiz.json загружен');
} catch (err) {
  console.error('❌ Ошибка в quiz.json:', err);
  process.exit(1);
}

initDb();
logger.info('База данных инициализирована');

// ─── Настройка бота ────────────────────────────────────────────────────────────

const bot = new Bot(token);

bot.catch((err) => {
  logger.error('Ошибка обработки', { err: String(err) });
});

// Debug-лог каждого входящего апдейта (пока не подтверждена стабильная работа)
bot.use(async (ctx, next) => {
  const u = ctx.update as Record<string, unknown>;
  const cb = (u as { callback?: { payload?: string } }).callback;
  logger.info(`Update: ${String(u.update_type)} от ${String(ctx.user?.user_id)}${cb?.payload ? ` payload=${cb.payload}` : ''}${ctx.messageId ? ` msgId=${ctx.messageId}` : ''}`);
  return next();
});

/** Загружает изображение в MAX и кеширует токен вложения на время жизни процесса. */
const imageCache = new Map<string, ImageAttachment>();
export async function getImageAttachment(relativePath: string): Promise<ImageAttachment | undefined> {
  if (!imageExists(relativePath)) return undefined;
  const cached = imageCache.get(relativePath);
  if (cached) return cached;
  const uploaded = await bot.api.uploadImage({ source: readImage(relativePath) });
  imageCache.set(relativePath, uploaded);
  return uploaded;
}

// Handlers (порядок регистрации важен!)
registerStartHandler(bot);
registerAdminHandler(bot);
registerQuizHandler(bot);

// ─── Служебные команды ─────────────────────────────────────────────────────────

// ─── Запуск ────────────────────────────────────────────────────────────────────

// Очистка устаревших сессий каждый час
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref();

void bot.start();
logger.info('Бот запущен (long polling)');
