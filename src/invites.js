/**
 * Sistem invite token QM-YWI.
 *
 * Token dibuat acak secara kriptografis, disimpan HANYA sebagai hash SHA-256
 * (tidak ada plaintext di database), dan hanya dapat diredeem satu kali.
 */

import crypto from 'node:crypto';
import { db, nowIso, withTransaction } from './db.js';
import { logger } from './logger.js';
import { TEXTS } from './texts.js';
import {
  createUser,
  getUserByTelegramId,
  updateUser,
  USER_STATUS
} from './users.js';
import { beginRegistration } from './registration.js';

// Alfabet bebas karakter ambigu (tanpa 0, 1, I, L, O, U).
const TOKEN_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const TOKEN_GROUPS = 3;
const GROUP_LENGTH = 4;

export const TOKEN_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Menghasilkan token undangan acak kriptografis, contoh: QMYWI-7K9P-X4M2-AB3C
 * @returns {string}
 */
export function generateInviteToken() {
  let body = '';
  const total = TOKEN_GROUPS * GROUP_LENGTH;
  for (let i = 0; i < total; i++) {
    body += TOKEN_ALPHABET[crypto.randomInt(0, TOKEN_ALPHABET.length)];
  }
  const groups = [];
  for (let i = 0; i < TOKEN_GROUPS; i++) {
    groups.push(body.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH));
  }
  return `QMYWI-${groups.join('-')}`;
}

/**
 * Normalisasi input token: trim, buang spasi, uppercase.
 * @param {string} input
 */
export function normalizeToken(input) {
  if (!input) return '';
  return String(input).trim().replace(/\s+/g, '').toUpperCase();
}

/**
 * Hash token yang sudah dinormalisasi.
 * @param {string} token
 */
export function hashInviteToken(token) {
  return crypto.createHash('sha256').update(normalizeToken(token), 'utf8').digest('hex');
}

/**
 * Membuat sejumlah token undangan baru.
 * @param {{ count: number, createdBy: string|number, ttlDays?: number|null }} options
 * @returns {Array<{ token: string, expiresAt: string|null }>}
 */
export function createInviteTokens({ count, createdBy, ttlDays = null }) {
  const created = [];
  const ttl = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : null;

  withTransaction(() => {
    for (let i = 0; i < count; i++) {
      let token;
      let hash;
      // Sangat kecil kemungkinannya bentrok, tetapi tetap dijaga.
      do {
        token = generateInviteToken();
        hash = hashInviteToken(token);
      } while (db.prepare('SELECT 1 FROM invite_tokens WHERE token_hash = ?').get(hash));

      const createdAt = nowIso();
      const expiresAt = ttl ? new Date(Date.now() + ttl * DAY_MS).toISOString() : null;

      db.prepare(
        `INSERT INTO invite_tokens (token_hash, status, created_by, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(hash, TOKEN_STATUS.AVAILABLE, String(createdBy), createdAt, expiresAt);

      created.push({ token, expiresAt });
    }
  });

  return created;
}

/**
 * Menandai token yang sudah lewat masa berlaku sebagai EXPIRED.
 */
export function markExpiredTokens() {
  db.prepare(
    `UPDATE invite_tokens SET status = ?
     WHERE status = ? AND expires_at IS NOT NULL AND expires_at <= ?`
  ).run(TOKEN_STATUS.EXPIRED, TOKEN_STATUS.AVAILABLE, nowIso());
}

/**
 * Daftar token (tanpa plaintext) untuk panel admin.
 * @param {number} limit
 */
export function listInviteTokens(limit = 50) {
  markExpiredTokens();
  const rows = db
    .prepare('SELECT * FROM invite_tokens ORDER BY id DESC LIMIT ?')
    .all(limit);
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedBy: row.used_by,
    usedAt: row.used_at
  }));
}

/**
 * Redeem token secara atomic: menandai token USED dan menaikkan user ke
 * REGISTRATION dalam satu transaksi. Tidak pernah membocorkan apakah token
 * tertentu pernah ada.
 *
 * @param {string} rawToken
 * @param {{ telegramUserId: string|number, telegramUsername?: string|null }} telegramUser
 * @returns {{ valid: boolean }}
 */
export function redeemTokenForUser(rawToken, { telegramUserId, telegramUsername = null }) {
  const hash = hashInviteToken(rawToken);

  return withTransaction(() => {
    const now = nowIso();
    const row = db.prepare('SELECT * FROM invite_tokens WHERE token_hash = ?').get(hash);

    if (!row || row.status !== TOKEN_STATUS.AVAILABLE) {
      return { valid: false };
    }

    if (row.expires_at && row.expires_at <= now) {
      db.prepare('UPDATE invite_tokens SET status = ? WHERE id = ?').run(TOKEN_STATUS.EXPIRED, row.id);
      return { valid: false };
    }

    const update = db
      .prepare(
        `UPDATE invite_tokens
         SET status = ?, used_by = ?, used_at = ?
         WHERE id = ? AND status = ?`
      )
      .run(TOKEN_STATUS.USED, String(telegramUserId), now, row.id, TOKEN_STATUS.AVAILABLE);

    if (update.changes !== 1) {
      // Sudah diambil request lain secara bersamaan.
      return { valid: false };
    }

    const existing = getUserByTelegramId(telegramUserId);
    if (existing) {
      updateUser(telegramUserId, {
        status: USER_STATUS.REGISTRATION,
        telegram_username: telegramUsername,
        invited_at: existing.invitedAt || now
      });
    } else {
      createUser({
        telegramUserId,
        telegramUsername,
        status: USER_STATUS.REGISTRATION,
        invitedAt: now
      });
    }

    return { valid: true };
  });
}

/**
 * Menampilkan permintaan token undangan.
 * @param {import('grammy').Context} ctx
 */
export async function sendInvitePrompt(ctx) {
  await ctx.reply(TEXTS.INVITE_PROMPT);
}

/**
 * Menangani input teks token dari user NEW.
 * @param {import('grammy').Context} ctx
 * @param {string} text
 * @param {{ id: number, username?: string }} from
 */
export async function handleTokenInput(ctx, text, from) {
  const normalized = normalizeToken(text);
  if (!normalized) {
    await ctx.reply(TEXTS.TOKEN_INVALID);
    return;
  }

  const result = redeemTokenForUser(normalized, {
    telegramUserId: from.id,
    telegramUsername: from.username || null
  });

  if (!result.valid) {
    await ctx.reply(TEXTS.TOKEN_INVALID);
    return;
  }

  logger.info(`Invite token diredeem oleh Telegram ID ${from.id}.`);
  await ctx.reply(TEXTS.TOKEN_VALID);
  await beginRegistration(ctx, from.id);
}
