/**
 * Repository pengguna QM-YWI.
 *
 * Identitas utama akun adalah `telegram_user_id` (unique). Nama tidak pernah
 * dipakai sebagai identifier. NIK bersifat unique.
 */

import { db, nowIso } from './db.js';

export const USER_STATUS = Object.freeze({
  NEW: 'NEW',
  REGISTRATION: 'REGISTRATION',
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED'
});

const ALLOWED_UPDATE_FIELDS = [
  'telegram_username',
  'name',
  'nik',
  'status',
  'invited_at',
  'registered_at'
];

/**
 * @param {any} row
 */
function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegramUserId: String(row.telegram_user_id),
    telegramUsername: row.telegram_username || null,
    name: row.name || null,
    nik: row.nik || null,
    status: row.status,
    invitedAt: row.invited_at || null,
    registeredAt: row.registered_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Mengambil user berdasarkan Telegram User ID.
 * @param {string|number} telegramUserId
 */
export function getUserByTelegramId(telegramUserId) {
  if (telegramUserId === undefined || telegramUserId === null) return null;
  const row = db
    .prepare('SELECT * FROM users WHERE telegram_user_id = ?')
    .get(String(telegramUserId));
  return rowToUser(row);
}

/**
 * Mengambil user berdasarkan primary key internal.
 * @param {number} id
 */
export function getUserById(id) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return rowToUser(row);
}

/**
 * Membuat user baru. Melempar error bila telegram_user_id sudah ada.
 * @param {{ telegramUserId: string|number, telegramUsername?: string|null, status?: string, invitedAt?: string|null }} data
 */
export function createUser({ telegramUserId, telegramUsername = null, status = USER_STATUS.NEW, invitedAt = null }) {
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO users (telegram_user_id, telegram_username, status, invited_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(String(telegramUserId), telegramUsername, status, invitedAt, now, now);

  return getUserById(Number(result.lastInsertRowid));
}

/**
 * Memperbarui field user secara terbatas.
 * @param {string|number} telegramUserId
 * @param {Record<string, any>} fields
 */
export function updateUser(telegramUserId, fields) {
  const sets = [];
  const values = [];

  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) {
      sets.push(`${field} = ?`);
      values.push(fields[field]);
    }
  }

  if (sets.length === 0) return getUserByTelegramId(telegramUserId);

  sets.push('updated_at = ?');
  values.push(nowIso());
  values.push(String(telegramUserId));

  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE telegram_user_id = ?`).run(...values);
  return getUserByTelegramId(telegramUserId);
}

/**
 * Membuat user bila belum ada, atau mengembalikan user yang sudah ada.
 * @param {string|number} telegramUserId
 * @param {string|null} telegramUsername
 */
export function getOrCreateUser(telegramUserId, telegramUsername = null) {
  const existing = getUserByTelegramId(telegramUserId);
  if (existing) {
    if (telegramUsername && telegramUsername !== existing.telegramUsername) {
      return updateUser(telegramUserId, { telegram_username: telegramUsername });
    }
    return existing;
  }
  return createUser({ telegramUserId, telegramUsername, status: USER_STATUS.NEW });
}

/**
 * Status user, default NEW bila belum terdaftar.
 * @param {string|number} telegramUserId
 */
export function getStatus(telegramUserId) {
  const user = getUserByTelegramId(telegramUserId);
  return user ? user.status : USER_STATUS.NEW;
}

/**
 * Cek apakah NIK sudah dipakai akun lain (bukan akun telegramUserId yang diberikan).
 * @param {string} nik
 * @param {string|number} telegramUserId
 * @returns {boolean}
 */
export function isNikTakenByOther(nik, telegramUserId) {
  if (!nik) return false;
  const row = db.prepare('SELECT telegram_user_id FROM users WHERE nik = ?').get(nik);
  if (!row) return false;
  return String(row.telegram_user_id) !== String(telegramUserId);
}

/**
 * Daftar seluruh user (terbaru lebih dulu).
 */
export function listUsers() {
  const rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  return rows.map(rowToUser);
}

/**
 * Menyamarkan NIK agar tidak ditampilkan lengkap.
 * @param {string|null} nik
 */
export function maskNik(nik) {
  if (!nik) return '-';
  return String(nik).replace(/\d/g, '*');
}
