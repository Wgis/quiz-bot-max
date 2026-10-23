import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'quiz.sqlite');

let db: Database | null = null;

export function initDb(): Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id  INTEGER PRIMARY KEY,
      username     TEXT,
      first_name   TEXT,
      last_name    TEXT,
      first_seen   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS results (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id  INTEGER NOT NULL,
      score        INTEGER NOT NULL,
      total        INTEGER NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
    );

    CREATE INDEX IF NOT EXISTS idx_results_telegram_id
      ON results(telegram_id);
  `);

  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
