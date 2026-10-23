import { Context, MiddlewareFn } from '@maxhub/max-bot-api';

const adminIds: Set<number> = new Set(
  (process.env.ADMIN_IDS ?? '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id) && id > 0),
);

export function isAdmin(userId: number): boolean {
  return adminIds.has(userId);
}

/** Middleware-guard для команд администратора. */
export const adminGuard: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.user?.user_id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('⛔ Доступ запрещён. Команда доступна только администраторам.');
    return;
  }
  return next();
};
