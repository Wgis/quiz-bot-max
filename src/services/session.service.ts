import { QuizSession } from '../types';

const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 часа

/** In-memory хранилище сессий. Ключ — telegram_id пользователя. */
const sessions = new Map<number, QuizSession>();

export function getSession(userId: number): QuizSession | undefined {
  return sessions.get(userId);
}

export function createSession(userId: number): QuizSession {
  const session: QuizSession = {
    status: 'active',
    currentQuestion: 0,
    score: 0,
    answered: false,
    startedAt: new Date(),
  };
  sessions.set(userId, session);
  return session;
}

/** Частичное обновление сессии — только переданные поля. */
export function updateSession(userId: number, patch: Partial<QuizSession>): void {
  const existing = sessions.get(userId);
  if (!existing) return;
  sessions.set(userId, { ...existing, ...patch });
}

export function deleteSession(userId: number): void {
  sessions.delete(userId);
}

export function getActiveSessionCount(): number {
  let count = 0;
  for (const s of sessions.values()) {
    if (s.status === 'active') count++;
  }
  return count;
}

/** Удаляет сессии, не активные дольше SESSION_TTL_MS. */
export function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [userId, session] of sessions.entries()) {
    if (now - session.startedAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(userId);
    }
  }
}
