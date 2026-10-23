import { Bot, Context, ImageAttachment, Keyboard } from '@maxhub/max-bot-api';
import { QuizQuestion } from '../types';
import { getQuiz, getResultEntry, imageExists, readImage } from '../services/quiz.service';
import { getLastResult, upsertUser } from '../services/db.service';
import { getImageAttachment } from '../bot';
import { logger } from '../utils/logger';

/** Клавиатура приветствия. */
export function welcomeKeyboard() {
  return Keyboard.inlineKeyboard([[Keyboard.button.callback('🚀 Начать викторину', 'quiz_begin')]]);
}

/** Регистрирует/обновляет пользователя в БД (нужен до saveResult из-за FK). */
function trackUser(ctx: Context): void {
  const u = ctx.user;
  if (!u) return;
  upsertUser(u.user_id, u.username ?? undefined, u.first_name, u.last_name ?? undefined);
}

export function registerStartHandler(bot: Bot): void {
  // Первый запуск бота пользователем (кнопка «Начать» в профиле бота)
  bot.on('bot_started', async (ctx: Context) => {
    trackUser(ctx);
    await sendWelcome(ctx);
  });

  bot.command('start', async (ctx: Context) => {
    trackUser(ctx);
    const previous = getLastResult(ctx.user!.user_id);
    if (previous) {
      // Уже проходил — показать информацию о викторине + личный результат
      const quiz = getQuiz();
      const resultEntry = getResultEntry(previous.score);
      const percent = Math.round((previous.score / previous.total) * 100);
      await ctx.reply(
        [
          `📋 Викторина «${quiz.title}»`,
          `Вопросов: ${quiz.questions.length}`,
          '',
          '─────────────────────',
          '👤 Ваш результат',
          `Правильных ответов: ${previous.score} из ${previous.total} (${percent}%)`,
          resultEntry?.text ?? '',
        ].filter((l) => l !== '').join('\n'),
      );
      return;
    }
    await sendWelcome(ctx);
  });
}

async function sendWelcome(ctx: Context): Promise<void> {
  const { welcome, welcome_image } = getQuiz();
  const attachments: any[] = [welcomeKeyboard()];

  if (welcome_image && imageExists(welcome_image)) {
    const img = await getImageAttachment(welcome_image);
    if (img) attachments.unshift(img.toJson());
  }

  await ctx.reply(welcome, { attachments, format: 'html' });
}
