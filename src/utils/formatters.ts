import { ExportRow, StatsRow, TopEntry } from '../types';

export const TOP_RESULTS_LIMIT = 5;

/** Экранирует HTML-спецсимволы для безопасной вставки в parse_mode: 'HTML'. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Убирает Telegram HTML-теги из текстов quiz.json (MAX не поддерживает разметку).
 * <b>/<i>/<u>/<s>/<code>/<pre>/<a ...> — содержимое остаётся, теги срезаются.
 */
export function stripHtml(str: string): string {
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

/** CSV-строка с proper-escaping (RFC 4180). */
export function buildCsv(rows: ExportRow[]): string {
  const columns: (keyof ExportRow)[] = [
    'telegram_id',
    'username',
    'first_name',
    'last_name',
    'score',
    'total',
    'completed_at',
    'first_seen',
  ];

  const escape = (val: unknown): string => {
    const str = val == null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.join(',');
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/**
 * Текстовый отчёт (MAX не принимает .html файлы — сервер отдаёт 415),
 * сортировка как в buildHtmlReport: по убыванию баллов, при равенстве — раньше завершился.
 */
export function buildTextReport(rows: ExportRow[]): string {
  const sorted = [...rows].sort((a, b) => b.score - a.score || (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));

  const nameOf = (row: ExportRow) => row.first_name ?? (row.username ? `@${row.username}` : 'Аноним');

  const placeW = 4;
  const nameW = Math.max(...sorted.map((r) => nameOf(r).length), 5) + 2;
  const idW = Math.max(...sorted.map((r) => String(r.telegram_id).length), 2) + 2;
  const scoreW = 12;
  const dateW = 19;

  const line = '─'.repeat(placeW + nameW + idW + scoreW + dateW + 3);
  const header = [
    '№'.padEnd(placeW),
    'Имя'.padEnd(nameW),
    'ID'.padEnd(idW),
    'Баллы'.padEnd(scoreW),
    'Дата',
  ].join(' | ');

  const body = sorted.map((row, i) => {
    const percent = row.total > 0 ? Math.round((row.score / row.total) * 100) : 0;
    return [
      String(i + 1).padEnd(placeW),
      nameOf(row).padEnd(nameW),
      String(row.telegram_id).padEnd(idW),
      `${row.score}/${row.total} (${percent}%)`.padEnd(scoreW),
      (row.completed_at ?? '').slice(0, 19),
    ].join(' | ');
  });

  return [
    `Результаты викторины (${sorted.length} чел.)`,
    line,
    header,
    line,
    ...body,
    line,
  ].join('\n');
}

/** HTML-отчёт с результатами, отсортированными от высоких баллов к низким. */
export function buildHtmlReport(rows: ExportRow[]): string {
  const sorted = [...rows].sort((a, b) => b.score - a.score || (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));

  const tableRows = sorted
    .map((row, i) => {
      const name = row.first_name ?? (row.username ? `@${row.username}` : 'Аноним');
      const nick = row.username ? `@${escapeHtml(row.username)}` : '—';
      const percent = row.total > 0 ? Math.round((row.score / row.total) * 100) : 0;
      return [
        `      <tr>`,
        `        <td class="num">${i + 1}</td>`,
        `        <td>${escapeHtml(name)}</td>`,
        `        <td>${nick}</td>`,
        `        <td class="num">${row.telegram_id}</td>`,
        `        <td class="num"><b>${row.score}</b> / ${row.total} (${percent}%)</td>`,
        `        <td>${escapeHtml(row.completed_at ?? '')}</td>`,
        `      </tr>`,
      ].join('\n');
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Результаты викторины «Динамо»</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #1a2733; }
  h1 { font-size: 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid #d5dce3; padding: 6px 10px; text-align: left; }
  th { background: #143c8c; color: #fff; position: sticky; top: 0; }
  tr:nth-child(even) { background: #f4f6f9; }
  .num { text-align: right; white-space: nowrap; }
</style>
</head>
<body>
<h1>📊 Результаты викторины «Динамо» (${rows.length} чел.)</h1>
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Имя</th>
      <th>Ник</th>
      <th>Telegram ID</th>
      <th>Баллы</th>
      <th>Дата</th>
    </tr>
  </thead>
  <tbody>
${tableRows}
  </tbody>
</table>
</body>
</html>
`;
}

/** Форматирует блок статистики для отправки в чат (HTML). */
export function formatStats(stats: StatsRow, activeSessions: number): string {
  return [
    '📊 <b>Статистика викторины</b>',
    '',
    `👥 Всего участников: <b>${stats.total_users}</b>`,
    `✅ Завершений: <b>${stats.total_completions}</b>`,
    `⭐ Средний балл: <b>${stats.avg_score ?? '—'}</b>`,
    `🔄 Сейчас проходят: <b>${activeSessions}</b>`,
  ].join('\n');
}

/** Форматирует имя пользователя для отображения (HTML-safe). */
export function displayName(
  username: string | null | undefined,
  firstName: string | null | undefined,
): string {
  if (firstName) return escapeHtml(firstName);
  if (username) return `@${escapeHtml(username)}`;
  return 'Аноним';
}

/** Собирает полное статистическое сообщение с топ-N результатов. */
export function buildStatsMessage(stats: StatsRow, activeSessions: number, top: TopEntry[]): string {
  let text = formatStats(stats, activeSessions);
  if (top.length > 0) {
    text += '\n\n🏅 <b>Топ-5 результатов:</b>\n';
    top.forEach((entry, i) => {
      text += `\n${i + 1}. ${displayName(entry.username, entry.first_name)} — ${entry.score}/${entry.total}`;
    });
  }
  return text;
}
