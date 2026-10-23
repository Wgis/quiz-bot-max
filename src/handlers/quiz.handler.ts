import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { getQuestion, getTotalQuestions, checkAnswer, getResultEntry, getQuiz } from '../services/quiz.service';
import {
  getSession,
  createSession,
  updateSession,
  deleteSession,
} from '../services/session.service';
import { saveResult, upsertUser } from '../services/db.service';
import { getImageAttachment } from '../bot';
import { imageExists } from '../services/quiz.service';
import { logger } from '../utils/logger';

// ─── Вспомогательные функции ───────────────────────────────────────────────────

type Kb = ReturnType<typeof Keyboard.inlineKeyboard>;

/** Клавиатура вопроса: по кнопке на вариант, каждый в своём ряду. */
function questionKeyboard(questionIndex: number, options: string[]): Kb {
  return Keyboard.inlineKeyboard(
    options.map((opt, i) => [Keyboard.button.callback(opt, `quiz_a_${questionIndex}_${i}`)]),
  );
}

/** Клавиатура после выбора: выбранное помечено 🔵, снизу кнопка перехода. */
function answeredKeyboard(questionIndex: number, options: string[], selectedIndex: number, nextButton: { text: string; payload: string }): Kb {
  const rows = options.map((opt, i) => [
    Keyboard.button.callback(i === selectedIndex ? `🔵 ${opt}` : opt, 'quiz_noop'),
  ]);
  rows.push([Keyboard.button.callback(nextButton.text, nextButton.payload)]);
  return Keyboard.inlineKeyboard(rows);
}

/**
 * Показывает вопрос: новое сообщение либо правка прежнего (editMsgId).
 * Возвращает message_id сообщения с вопросом.
 */
async function showQuestion(ctx: Context, questionIndex: number, editMsgId?: string): Promise<string | undefined> {
  const question = getQuestion(questionIndex);
  if (!question) return undefined;

  const total = getTotalQuestions();
  const text = `❓ Вопрос ${questionIndex + 1} из ${total}\n\n${question.text}`;
  const attachments: any[] = [];

  if (question.image) {
    const img = await getImageAttachment(question.image);
    if (img) attachments.push(img.toJson());
  }
  attachments.push(questionKeyboard(questionIndex, question.options));

  // Правка прежнего сообщения — викторина идёт одним сообщением
  if (editMsgId) {
    try {
      await ctx.api.editMessage(editMsgId, { text, attachments, format: 'html' });
      return editMsgId;
    } catch (e) {
      // Не удалось отредактировать — отправим новое
      logger.error('showQuestion: правка не удалась, шлём новое сообщение', { err: String(e) });
    }
  }

  const msg = await ctx.reply(text, { attachments, format: 'html' });
  // У MAX id сообщения лежит в body.mid (поля message_id нет)
  const newId = (msg as { body?: { mid?: string } }).body?.mid;
  logger.info(`showQuestion: вопрос ${questionIndex + 1} отправлен, msgId=${newId}`);
  return newId;
}

// ─── Регистрация обработчиков ──────────────────────────────────────────────────

export function registerQuizHandler(bot: Bot): void {
  // ── Старт викторины ─────────────────────────────────────────────────────────
  bot.action('quiz_begin', async (ctx) => {
    const userId = ctx.user!.user_id;
    upsertUser(userId, ctx.user!.username ?? undefined, ctx.user!.first_name, ctx.user!.last_name ?? undefined);

    // Двойная защита: если уже есть результат в БД
    if (getSession(userId)?.status === 'active') {
      await ctx.answerOnCallback({ notification: 'Викторина уже идёт' }).catch(() => {});
      return;
    }

    createSession(userId);

    // Убираем кнопку у приветствия (attachments: [] удалил бы и картинку —
    // поэтому передаём картинку заново, но уже без клавиатуры)
    try {
      const { welcome, welcome_image } = getQuiz();
      const keep: any[] = [];
      if (welcome_image && imageExists(welcome_image)) {
        const img = await getImageAttachment(welcome_image);
        if (img) keep.push(img.toJson());
      }
      await ctx.api.editMessage(ctx.messageId!, { text: welcome, attachments: keep, format: 'html' });
    } catch (e) {
      logger.error('quiz_begin: не удалось убрать кнопку у приветствия', { err: String(e) });
    }

    const msgId = await showQuestion(ctx, 0);
    updateSession(userId, { currentMsgId: msgId, answered: false });
  });

  // Заглушка для задизейбленных кнопок
  bot.action('quiz_noop', async (ctx) => {
    await ctx.answerOnCallback({ notification: 'Вариант уже выбран' }).catch(() => {});
  });

  // ── Ответ на вопрос ─────────────────────────────────────────────────────────
  bot.action(/^quiz_a_(\d+)_(\d+)$/, async (ctx) => {
    const userId = ctx.user!.user_id;
    const session = getSession(userId);
    const msgId = ctx.messageId;
    logger.info(`quiz_a: вопрос=${ctx.match?.[1]} выбор=${ctx.match?.[2]} msgId=${msgId} сессия: currentMsgId=${session?.currentMsgId} answered=${session?.answered} status=${session?.status}`);

    if (!session || session.status !== 'active') {
      logger.info('quiz_a: выход — нет активной сессии');
      await ctx.answerOnCallback({ notification: 'Начните викторину с /start' }).catch(() => {});
      return;
    }

    // Stale callback — кнопка из старого вопроса
    if (msgId !== session.currentMsgId) {
      logger.info('quiz_a: выход — stale msgId (кнопка старого вопроса)');
      await ctx.answerOnCallback({ notification: 'Этот вопрос уже пройден' }).catch(() => {});
      return;
    }

    // Защита от двойного клика
    if (session.answered) {
      logger.info('quiz_a: выход — ответ уже отмечен');
      await ctx.answerOnCallback({ notification: 'Вы уже ответили на этот вопрос' }).catch(() => {});
      return;
    }

    const questionIndex = parseInt(ctx.match?.[1] ?? '', 10);
    const choiceIndex = parseInt(ctx.match?.[2] ?? '', 10);
    const question = getQuestion(questionIndex);
    if (!question) return;

    // Синхронно отмечаем ответ, чтобы исключить гонку на async-операциях
    updateSession(userId, { answered: true });

    const isCorrect = checkAnswer(questionIndex, choiceIndex);
    if (isCorrect) {
      updateSession(userId, { score: session.score + 1 });
    }

    // Отмечаем выбор в клавиатуре того же сообщения
    const isLast = questionIndex === getTotalQuestions() - 1;
    const nextButton = {
      text: isLast ? '🏆 Посмотреть результат' : '➡️ Следующий вопрос',
      payload: `quiz_next_${questionIndex}`,
    };

    const attachments: any[] = [];
    if (question.image) {
      const img = await getImageAttachment(question.image);
      if (img) attachments.push(img.toJson());
    }
    attachments.push(answeredKeyboard(questionIndex, question.options, choiceIndex, nextButton));

    try {
      const res = await ctx.api.editMessage(msgId!, {
        text: questionText(questionIndex),
        attachments,
        format: 'html',
      });
      if (res && typeof res === 'object' && 'success' in res && !res.success) {
        logger.error('Ответ: MAX отклонил правку клавиатуры', { res: JSON.stringify(res) });
      }
    } catch (e) {
      logger.error('Ответ: правка сообщения не удалась', { err: String(e) });
    }
  });

  // ── Следующий вопрос / финал ─────────────────────────────────────────────────
  bot.action(/^quiz_next_(\d+)$/, async (ctx) => {
    const userId = ctx.user!.user_id;
    const session = getSession(userId);

    if (!session || session.status !== 'active') {
      await ctx.answerOnCallback({}).catch(() => {});
      return;
    }

    const fromIndex = parseInt(ctx.match?.[1] ?? '', 10);
    if (fromIndex !== session.currentQuestion) {
      await ctx.answerOnCallback({}).catch(() => {}); // stale кнопка
      return;
    }

    // Синхронно двигаем вперёд — защита от двойного нажатия
    const nextIndex = fromIndex + 1;
    const total = getTotalQuestions();
    const finalScore = session.score; // сохраняем до deleteSession
    updateSession(userId, { currentQuestion: nextIndex, answered: false });

    await ctx.answerOnCallback({}).catch(() => {});

    if (nextIndex >= total) {
      // ── Викторина завершена: вопрос удаляем, результат шлём отдельным сообщением
      deleteSession(userId);
      saveResult(userId, finalScore, total);

      if (session.currentMsgId) {
        try {
          await ctx.api.deleteMessage(session.currentMsgId);
        } catch { /* сообщение могло устареть — игнорируем */ }
      }

      const resultEntry = getResultEntry(finalScore);
      const { title } = getQuiz();
      await ctx.reply(
        [
          `🎉 Викторина «${title}» завершена!`,
          '',
          `Вы набрали ${finalScore} из ${total} баллов.`,
          resultEntry?.text ?? '',
        ].filter((l) => l !== '').join('\n'),
        { format: 'html' },
      );
    } else {
      // ── Следующий вопрос: обновляем то же сообщение
      const msgId = await showQuestion(ctx, nextIndex, session.currentMsgId);
      updateSession(userId, { currentMsgId: msgId, answered: false });
    }
  });

  // ── Текстовые сообщения во время прохождения ───────────────────────────────
  bot.on('message_created', async (ctx) => {
    const text = ctx.message?.body.text ?? '';
    if (text.startsWith('/')) return;
    const userId = (ctx.user as { user_id?: number } | undefined)?.user_id;
    if (!userId) return;
    const session = getSession(userId);
    if (session?.status === 'active') {
      await ctx.reply('Нажмите на одну из кнопок с вариантами ответа 👇');
    } else {
      await ctx.reply('Напишите /start чтобы начать викторину 🏆');
    }
  });
}

function questionText(questionIndex: number): string {
  const question = getQuestion(questionIndex)!;
  const total = getTotalQuestions();
  return `❓ Вопрос ${questionIndex + 1} из ${total}\n\n${question.text}`;
}
