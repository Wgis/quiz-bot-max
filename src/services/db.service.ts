import { getDb } from '../db/init';
import { ExportRow, StatsRow, TopEntry } from '../types';

export function upsertUser(
  telegramId: number,
  username: string | undefined,
  firstName: string | undefined,
  lastName: string | undefined,
): void {
  getDb()
    .prepare(
      `INSERT INTO users (telegram_id, username, first_name, last_name)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(telegram_id) DO UPDATE SET
         username   = excluded.username,
         first_name = excluded.first_name,
         last_name  = excluded.last_name`,
    )
    .run(telegramId, username ?? null, firstName ?? null, lastName ?? null);
}

export function saveResult(telegramId: number, score: number, total: number): void {
  getDb()
    .prepare(`INSERT INTO results (telegram_id, score, total) VALUES (?, ?, ?)`)
    .run(telegramId, score, total);
}

export function getLastResult(telegramId: number): { score: number; total: number } | undefined {
  return getDb()
    .prepare(
      `SELECT score, total FROM results WHERE telegram_id = ? ORDER BY completed_at DESC LIMIT 1`,
    )
    .get(telegramId) as { score: number; total: number } | undefined;
}

export function getStats(): StatsRow {
  return getDb()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users)   AS total_users,
         COUNT(*)                        AS total_completions,
         ROUND(AVG(score), 2)           AS avg_score
       FROM results`,
    )
    .get() as StatsRow;
}

export function getTopResults(limit = 10): TopEntry[] {
  return getDb()
    .prepare(
      `SELECT u.username, u.first_name, r.score, r.total, r.completed_at
       FROM results r
       JOIN users u ON u.telegram_id = r.telegram_id
       ORDER BY r.score DESC, r.completed_at ASC
       LIMIT ?`,
    )
    .all(limit) as TopEntry[];
}

export function getAllResultsForExport(): ExportRow[] {
  return getDb()
    .prepare(
      `SELECT
         u.telegram_id,
         u.username,
         u.first_name,
         u.last_name,
         u.first_seen,
         r.id   AS result_id,
         r.score,
         r.total,
         r.completed_at
       FROM results r
       JOIN users u ON u.telegram_id = r.telegram_id
       ORDER BY r.completed_at ASC`,
    )
    .all() as ExportRow[];
}

export function resetResults(): number {
  const info = getDb().prepare('DELETE FROM results').run();
  return info.changes;
}

export function resetAll(): number {
  let total = 0;
  const tx = getDb().transaction(() => {
    total += getDb().prepare('DELETE FROM results').run().changes;
    total += getDb().prepare('DELETE FROM users').run().changes;
  });
  tx();
  return total;
}
