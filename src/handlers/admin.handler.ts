import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { adminGuard } from '../middlewares/auth.middleware';
import { getStats, getAllResultsForExport, getTopResults, resetResults, resetAll } from '../services/db.service';
import { getActiveSessionCount } from '../services/session.service';
import { buildHtmlReport, buildTextReport, buildStatsMessage, TOP_RESULTS_LIMIT } from '../utils/formatters';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

/** Заменяет текст меню сброса и убирает клавиатуру (attachments: [] снимает и её). */
async function editAndCloseMenu(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.api.editMessage(ctx.messageId!, { text, attachments: [], format: 'html' });
  } catch (e) {
    logger.error('/reset: не удалось обновить меню', { err: String(e) });
    await ctx.reply(text, { format: 'html' }).catch(() => {});
  }
}

export function registerAdminHandler(bot: Bot): void {
  // ── /stats (только для администраторов) ───────────────────────────────────
  bot.command('stats', adminGuard, async (ctx) => {
    const stats = getStats();
    const activeSessions = getActiveSessionCount();
    const top = getTopResults(TOP_RESULTS_LIMIT);
    await ctx.reply(buildStatsMessage(stats, activeSessions, top), { format: 'html' });
  });

  // ── /export — HTML-отчёт файлом (только для администраторов) ──────────────
  bot.command('export', adminGuard, async (ctx) => {
    const rows = getAllResultsForExport();
    if (rows.length === 0) {
      await ctx.reply('📭 Пока нет ни одного завершённого результата — выгружать нечего.');
      return;
    }

    // MAX не принимает файлы .html (сервер отвечает 415), поэтому отчёт текстовым файлом
    const report = buildTextReport(rows);
    const date = new Date().toISOString().slice(0, 10);
    const tmpPath = path.join(os.tmpdir(), `quiz_results_${date}.txt`);
    fs.writeFileSync(tmpPath, report, 'utf-8');

    try {
      // Имя файла в MAX берётся из имени файла-источника
      const file = await ctx.api.uploadFile({ source: tmpPath });
      await ctx.reply('📊 Отчёт по результатам викторины (отсортирован по убыванию баллов)', {
        attachments: [file.toJson()],
      });
    } catch (e) {
      logger.error('/export: не удалось выгрузить отчёт', { err: String(e) });
      await ctx.reply('❌ Не удалось сформировать отчёт — подробности в логах.');
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  });

  // ── /reset — сброс результатов или всей БД (только для администраторов) ───
  bot.command('reset', adminGuard, async (ctx) => {
    const kb = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('🗑 Только результаты', 'admin_reset_scores')],
      [Keyboard.button.callback('☢️ Всё (пользователи + результаты)', 'admin_reset_all')],
      [Keyboard.button.callback('❌ Отмена', 'admin_reset_cancel')],
    ]);
    await ctx.reply(
      '⚠️ <b>Что именно сбросить?</b>\n\nВыберите действие:',
      { attachments: [kb], format: 'html' },
    );
  });

  // Подтверждение: только результаты
  bot.action('admin_reset_scores', adminGuard, async (ctx) => {
    await ctx.answerOnCallback({}).catch(() => {});
    const deleted = resetResults();
    await editAndCloseMenu(ctx, `✅ Удалено результатов: <b>${deleted}</b>. Пользователи сохранены.`);
  });

  // Подтверждение: полный сброс
  bot.action('admin_reset_all', adminGuard, async (ctx) => {
    await ctx.answerOnCallback({}).catch(() => {});
    const deleted = resetAll();
    await editAndCloseMenu(ctx, `✅ База данных полностью очищена. Удалено записей: <b>${deleted}</b>.`);
  });

  // Отмена
  bot.action('admin_reset_cancel', adminGuard, async (ctx) => {
    await ctx.answerOnCallback({ notification: 'Отменено' }).catch(() => {});
    await editAndCloseMenu(ctx, '❌ Сброс отменён.');
  });

  // ── /users ────────────────────────────────────────────────────────────────
  bot.command('users', adminGuard, async (ctx) => {
    const stats = getStats();
    await ctx.reply(`👥 Зарегистрировано пользователей: <b>${stats.total_users}</b>`, { format: 'html' });
  });

  // ── /adminhelp ────────────────────────────────────────────────────────────
  bot.command('adminhelp', adminGuard, async (ctx) => {
    await ctx.reply(
      [
        '🛠 Команды администратора',
        '',
        '/stats — статистика (участники, завершения, средний балл, топ-5) [только для администраторов]',
        '/export — выгрузить все результаты в текстовом отчёте (по убыванию баллов)',
        '/reset — сбросить результаты или всю БД',
        '/users — число зарегистрированных пользователей',
        '/adminhelp — это сообщение',
      ].join('\n'),
    );
  });
}
