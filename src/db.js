/**
 * Lapisan persistence QM-YWI Telegram Bot.
 *
 * Menggunakan SQLite bawaan Node (`node:sqlite`, Node >= 22.5) sehingga tidak
 * menambah dependency baru. Database bersifat file-based agar data user,
 * invite token, status, dan state registrasi tetap ada setelah restart/redeploy.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Menyiapkan direktori database bila path berupa file.
 * @param {string} dbPath
 */
function ensureDbDirectory(dbPath) {
  if (dbPath === ':memory:' || dbPath.startsWith('file:')) return;
  const absolute = path.resolve(dbPath);
  const dir = path.dirname(absolute);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDbDirectory(config.DB_PATH);

export const db = new DatabaseSync(config.DB_PATH);

// Konfigurasi SQLite
db.exec('PRAGMA foreign_keys = ON;');
try {
  // WAL tidak didukung untuk database in-memory.
  db.exec('PRAGMA journal_mode = WAL;');
} catch {
  // Diabaikan: mode in-memory tidak mendukung WAL.
}
db.exec('PRAGMA busy_timeout = 5000;');

/**
 * Membuat schema bila belum ada.
 */
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id  TEXT NOT NULL UNIQUE,
      telegram_username TEXT,
      name              TEXT,
      nik               TEXT UNIQUE,
      status            TEXT NOT NULL DEFAULT 'NEW'
                        CHECK (status IN ('NEW', 'REGISTRATION', 'ACTIVE', 'BLOCKED')),
      invited_at        TEXT,
      registered_at     TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash  TEXT NOT NULL UNIQUE,
      status      TEXT NOT NULL DEFAULT 'AVAILABLE'
                  CHECK (status IN ('AVAILABLE', 'USED', 'EXPIRED', 'REVOKED')),
      created_by  TEXT,
      created_at  TEXT NOT NULL,
      expires_at  TEXT,
      used_by     TEXT,
      used_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_invite_tokens_status ON invite_tokens(status);

    CREATE TABLE IF NOT EXISTS employees (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nik         TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      created_by  TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
  `);
}

migrate();
logger.info(`Persistence SQLite aktif pada: ${config.DB_PATH}`);

/**
 * Timestamp ISO-8601 saat ini.
 * @returns {string}
 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * Menjalankan fungsi di dalam transaksi SQLite.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function withTransaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Abaikan kegagalan rollback agar error asli tetap dilempar.
    }
    throw err;
  }
}
