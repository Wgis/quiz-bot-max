// ─── Структуры данных викторины ───────────────────────────────────────────────

export interface QuizQuestion {
  id: number;
  text: string;
  /** Изображение к самому вопросу (показывается вместе с вопросом) */
  image?: string | null;
  options: string[];
  /** 0-based индекс правильного ответа */
  correct: number;
  /** Пояснение после ответа; если не задано — не отправляется */
  feedback_correct?: string;
  feedback_wrong?: string;
}

export interface QuizResult {
  min: number;
  max: number;
  text?: string;
  image?: string;
}

export interface QuizData {
  title: string;
  welcome: string;
  /** Приветственное изображение */
  welcome_image?: string;
  questions: QuizQuestion[];
  results: QuizResult[];
}

// ─── Сессия пользователя (in-memory) ──────────────────────────────────────────

export type SessionStatus = 'active' | 'finished';

export interface QuizSession {
  status: SessionStatus;
  currentQuestion: number;
  score: number;
  /** Защита от двойного клика на вариант ответа */
  answered: boolean;
  /** message_id текущего вопроса для валидации stale callback */
  currentMsgId?: string;
  startedAt: Date;
}

// ─── Строки БД ─────────────────────────────────────────────────────────────────

export interface UserRow {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  first_seen: string;
}

export interface ResultRow {
  id: number;
  telegram_id: number;
  score: number;
  total: number;
  completed_at: string;
}

export interface StatsRow {
  total_users: number;
  total_completions: number;
  avg_score: number | null;
}

export interface ExportRow extends UserRow {
  result_id: number;
  score: number;
  total: number;
  completed_at: string;
}

export interface TopEntry {
  username: string | null;
  first_name: string | null;
  score: number;
  total: number;
  completed_at: string;
}
