/**
 * Panel administrator / owner QM-YWI.
 *
 * Hanya OWNER_TELEGRAM_ID yang boleh mengakses. Setiap callback admin
 * diverifikasi ulang sebagai owner (defense in depth).
 */

import { isOwner } from './access.js';
import { TEXTS } from './texts.js';
import {
  listUsers,
  getUserById,
  updateUser,
  USER_STATUS,
  maskNik
} from './users.js';
import { createInviteTokens, listInviteTokens } from './invites.js';
import { safeAnswerCallback } from './registration.js';
import {
  bulkImportEmployees,
  listEmployees,
  deleteEmployee,
  countEmployees,
  getEmployeeByNik
} from './employees.js';

const MAX_TOKENS_PER_BATCH = 50;
const MAX_USERS_LISTED = 20;

// State sementara alur admin (tidak kritis, cukup in-memory).
const adminPending = new Map();

const ADMIN_CALLBACK = {
  PANEL: 'admin:panel',
  CREATE_TOKEN: 'admin:create_token',
  LIST_TOKENS: 'admin:list_tokens',
  LIST_USERS: 'admin:list_users',
  EMPLOYEES: 'admin:employees',
  EMPLOYEE_ADD: 'admin:employees:add',
  EMPLOYEE_LIST: 'admin:employees:list',
  EMPLOYEE_DELETE: 'admin:employees:delete'
};

const MAX_EMPLOYEES_LISTED = 100;

/**
 * @param {string|number} telegramUserId
 */
function getPending(telegramUserId) {
  return adminPending.get(String(telegramUserId)) || null;
}

function setPending(telegramUserId, value) {
  adminPending.set(String(telegramUserId), value);
}

function clearPending(telegramUserId) {
  adminPending.delete(String(telegramUserId));
}

function formatDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return String(value);
  }
}

function adminPanelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🎟 Buat Token', callback_data: ADMIN_CALLBACK.CREATE_TOKEN }],
      [
        { text: '📋 Daftar Token', callback_data: ADMIN_CALLBACK.LIST_TOKENS },
        { text: '👥 Daftar Pengguna', callback_data: ADMIN_CALLBACK.LIST_USERS }
      ],
      [{ text: '👔 Data Karyawan', callback_data: ADMIN_CALLBACK.EMPLOYEES }]
    ]
  };
}

function adminPanelText() {
  return `🛠 *PANEL ADMINISTRATOR QM-YWI*

Pilih menu di bawah ini.`;
}

/**
 * Menampilkan panel admin (edit bila dari callback, reply bila dari command).
 * @param {import('grammy').Context} ctx
 * @param {{ edit?: boolean }} [options]
 */
export async function sendAdminPanel(ctx, { edit = false } = {}) {
  const text = adminPanelText();
  const keyboard = adminPanelKeyboard();
  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Command /admin.
 * @param {import('grammy').Context} ctx
 */
export async function handleAdminCommand(ctx) {
  if (!isOwner(ctx.from?.id)) {
    await ctx.reply(TEXTS.ADMIN_DENIED);
    return;
  }
  clearPending(ctx.from.id);
  await sendAdminPanel(ctx);
}

/**
 * Menampilkan daftar token undangan.
 * @param {import('grammy').Context} ctx
 */
async function showTokenList(ctx) {
  const tokens = listInviteTokens(MAX_TOKENS_PER_BATCH);
  const lines = ['🎟 DAFTAR TOKEN UNDANGAN', ''];

  if (tokens.length === 0) {
    lines.push('Belum ada token undangan.');
  } else {
    for (const token of tokens) {
      lines.push(`#${token.id} ${token.status}`);
      lines.push(`   Dibuat: ${formatDateTime(token.createdAt)}`);
      lines.push(`   Exp: ${token.expiresAt ? formatDateTime(token.expiresAt) : '-'}`);
      if (token.usedBy) {
        lines.push(`   Digunakan oleh: ${token.usedBy} (${formatDateTime(token.usedAt)})`);
      }
      lines.push('');
    }
    lines.push('_Token asli tidak ditampilkan karena hanya disimpan sebagai hash._');
  }

  await ctx.editMessageText(lines.join('\n'), {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: ADMIN_CALLBACK.PANEL }]] }
  });
}

/**
 * Menampilkan daftar pengguna (NIK disamarkan).
 * @param {import('grammy').Context} ctx
 */
async function showUserList(ctx) {
  const users = listUsers().slice(0, MAX_USERS_LISTED);
  const lines = ['👥 DAFTAR PENGGUNA', ''];

  if (users.length === 0) {
    lines.push('Belum ada pengguna terdaftar.');
  } else {
    users.forEach((user, index) => {
      lines.push(`${index + 1}. ${user.name || '(belum ada nama)'}`);
      lines.push(`   NIK: ${maskNik(user.nik)}`);
      lines.push(`   Status: ${user.status}`);
      lines.push('');
    });
  }

  const buttons = users.map((user, index) => [
    {
      text: `${index + 1}. ${user.name || 'Tanpa Nama'} (${user.status})`,
      callback_data: `admin:user:${user.id}`
    }
  ]);
  buttons.push([{ text: '⬅️ Kembali', callback_data: ADMIN_CALLBACK.PANEL }]);

  await ctx.editMessageText(lines.join('\n'), {
    reply_markup: { inline_keyboard: buttons }
  });
}

/**
 * Panel data karyawan (direktori NIK -> NAMA).
 * @param {import('grammy').Context} ctx
 */
async function showEmployeePanel(ctx) {
  const total = countEmployees();
  const text = `👔 *DATA KARYAWAN*

Total karyawan terdaftar: *${total}*

Data ini dipakai bot untuk mengenali NAMA otomatis saat user baru
memasukkan NIK. Pilih menu:`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Tambah Karyawan', callback_data: ADMIN_CALLBACK.EMPLOYEE_ADD }],
      [{ text: '📋 Daftar Karyawan', callback_data: ADMIN_CALLBACK.EMPLOYEE_LIST }],
      [{ text: '🗑 Hapus Karyawan', callback_data: ADMIN_CALLBACK.EMPLOYEE_DELETE }],
      [{ text: '⬅️ Kembali', callback_data: ADMIN_CALLBACK.PANEL }]
    ]
  };
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * Daftar karyawan.
 * @param {import('grammy').Context} ctx
 */
async function showEmployeeList(ctx) {
  const total = countEmployees();
  const employees = listEmployees(MAX_EMPLOYEES_LISTED);
  const lines = [`👔 DAFTAR KARYAWAN (${total} total)`, ''];

  if (employees.length === 0) {
    lines.push('Belum ada data karyawan.');
  } else {
    employees.forEach((employee, index) => {
      lines.push(`${index + 1}. ${employee.nik} — ${employee.name}`);
    });
  }

  await ctx.editMessageText(lines.join('\n'), {
    reply_markup: {
      inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: ADMIN_CALLBACK.EMPLOYEES }]]
    }
  });
}

/**
 * Detail pengguna + tombol blokir/aktifkan.
 * @param {object} user
 */
function userDetail(user) {
  const text = `👤 DETAIL PENGGUNA

Nama: ${user.name || '-'}
Username: ${user.telegramUsername ? '@' + user.telegramUsername : '-'}
Telegram ID: ${user.telegramUserId}
NIK: ${maskNik(user.nik)}
Status: ${user.status}
Diundang: ${formatDateTime(user.invitedAt)}
Terdaftar: ${formatDateTime(user.registeredAt)}`;

  const buttons = [];
  if (user.status === USER_STATUS.BLOCKED) {
    buttons.push([{ text: '✅ Aktifkan Kembali', callback_data: `admin:unblock:${user.id}` }]);
  } else {
    buttons.push([{ text: '🚫 Blokir', callback_data: `admin:block:${user.id}` }]);
  }
  buttons.push([{ text: '⬅️ Kembali', callback_data: ADMIN_CALLBACK.LIST_USERS }]);

  return { text, keyboard: { inline_keyboard: buttons } };
}

async function showUserDetail(ctx, userId) {
  const user = getUserById(Number(userId));
  if (!user) {
    await safeAnswerCallback(ctx, 'Pengguna tidak ditemukan.', true);
    return;
  }
  const { text, keyboard } = userDetail(user);
  await ctx.editMessageText(text, { reply_markup: keyboard });
}

/**
 * Membuat token lalu menampilkan hasilnya hanya kepada owner.
 * @param {import('grammy').Context} ctx
 * @param {number} count
 * @param {number|null} ttlDays
 */
async function generateAndShowTokens(ctx, count, ttlDays) {
  const created = createInviteTokens({
    count,
    createdBy: ctx.from.id,
    ttlDays
  });

  const expiryLabel = ttlDays ? `${ttlDays} hari` : 'Tidak Expired';
  const lines = [
    `✅ Berhasil membuat ${created.length} token undangan`,
    `Masa berlaku: ${expiryLabel}`,
    '',
    ...created.map((item) => item.token),
    '',
    '⚠️ Simpan token ini sekarang. Token tidak dapat ditampilkan lagi setelah pesan ini.'
  ];

  await ctx.reply(lines.join('\n'), {
    reply_markup: { inline_keyboard: [[{ text: '🛠 Panel Admin', callback_data: ADMIN_CALLBACK.PANEL }]] }
  });
}

/**
 * Middleware callback admin. Didaftarkan sebelum handler callback utama.
 * @param {import('grammy').Context} ctx
 * @param {() => Promise<void>} next
 */
export async function adminCallbackMiddleware(ctx, next) {
  const data = ctx.callbackQuery?.data || '';
  if (!data.startsWith('admin:')) {
    await next();
    return;
  }

  const ownerId = ctx.from?.id;
  if (!isOwner(ownerId)) {
    // Verifikasi ulang: callback admin harus owner.
    await safeAnswerCallback(ctx, TEXTS.ADMIN_DENIED, true);
    return;
  }

  try {
    if (data === ADMIN_CALLBACK.PANEL) {
      await safeAnswerCallback(ctx);
      await sendAdminPanel(ctx, { edit: true });
      return;
    }

    if (data === ADMIN_CALLBACK.CREATE_TOKEN) {
      setPending(ownerId, { action: 'awaiting_count' });
      await safeAnswerCallback(ctx);
      await ctx.editMessageText(
        `🎟 *BUAT TOKEN UNDANGAN*\n\nBerapa token yang ingin dibuat?\nKirim angka (contoh: \`5\`). Maksimal ${MAX_TOKENS_PER_BATCH} per pembuatan.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '⬅️ Batal', callback_data: ADMIN_CALLBACK.PANEL }]] } }
      );
      return;
    }

    if (data === ADMIN_CALLBACK.LIST_TOKENS) {
      await safeAnswerCallback(ctx);
      await showTokenList(ctx);
      return;
    }

    if (data === ADMIN_CALLBACK.LIST_USERS) {
      await safeAnswerCallback(ctx);
      await showUserList(ctx);
      return;
    }

    if (data === ADMIN_CALLBACK.EMPLOYEES) {
      await safeAnswerCallback(ctx);
      await showEmployeePanel(ctx);
      return;
    }

    if (data === ADMIN_CALLBACK.EMPLOYEE_LIST) {
      await safeAnswerCallback(ctx);
      await showEmployeeList(ctx);
      return;
    }

    if (data === ADMIN_CALLBACK.EMPLOYEE_ADD) {
      setPending(ownerId, { action: 'awaiting_employees' });
      await safeAnswerCallback(ctx);
      await ctx.editMessageText(
        `➕ *TAMBAH DATA KARYAWAN*\n\nKirim data dengan format satu karyawan per baris:\n\`NIK,Nama\`\n\nContoh (boleh banyak sekaligus):\n\`12345678,Budi Santoso\`\n\`87654321,Siti Aminah\`\n\nNIK harus 8 digit angka. NIK yang sudah ada akan diperbarui namanya.`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Batal', callback_data: ADMIN_CALLBACK.EMPLOYEES }]] }
        }
      );
      return;
    }

    if (data === ADMIN_CALLBACK.EMPLOYEE_DELETE) {
      setPending(ownerId, { action: 'awaiting_delete_employee' });
      await safeAnswerCallback(ctx);
      await ctx.editMessageText(
        `🗑 *HAPUS DATA KARYAWAN*\n\nKirim NIK (8 digit) yang ingin dihapus.`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '⬅️ Batal', callback_data: ADMIN_CALLBACK.EMPLOYEES }]] }
        }
      );
      return;
    }

    if (data.startsWith('admin:user:')) {
      await safeAnswerCallback(ctx);
      await showUserDetail(ctx, data.split(':')[2]);
      return;
    }

    if (data.startsWith('admin:block:')) {
      const id = data.split(':')[2];
      const user = getUserById(Number(id));
      if (user) {
        updateUser(user.telegramUserId, { status: USER_STATUS.BLOCKED });
        await safeAnswerCallback(ctx, `${user.name || 'Pengguna'} diblokir.`);
      } else {
        await safeAnswerCallback(ctx, 'Pengguna tidak ditemukan.', true);
      }
      await showUserDetail(ctx, id);
      return;
    }

    if (data.startsWith('admin:unblock:')) {
      const id = data.split(':')[2];
      const user = getUserById(Number(id));
      if (user) {
        // Kembalikan ke ACTIVE bila registrasi pernah selesai, jika belum
        // kembalikan ke REGISTRATION agar data diri tetap dilengkapi.
        const nextStatus = user.registeredAt ? USER_STATUS.ACTIVE : USER_STATUS.REGISTRATION;
        updateUser(user.telegramUserId, { status: nextStatus });
        await safeAnswerCallback(ctx, `${user.name || 'Pengguna'} diaktifkan kembali.`);
      } else {
        await safeAnswerCallback(ctx, 'Pengguna tidak ditemukan.', true);
      }
      await showUserDetail(ctx, id);
      return;
    }

    if (data.startsWith('admin:expiry:')) {
      const choice = data.split(':')[2];
      const pending = getPending(ownerId);
      if (!pending || pending.action !== 'awaiting_expiry') {
        await safeAnswerCallback(ctx, 'Sesi pembuatan token tidak aktif. Ulangi dari panel admin.', true);
        await sendAdminPanel(ctx, { edit: true });
        return;
      }
      const ttlDays = choice === 'none' ? null : parseInt(choice, 10);
      clearPending(ownerId);
      await safeAnswerCallback(ctx);
      await generateAndShowTokens(ctx, pending.count, Number.isFinite(ttlDays) ? ttlDays : null);
      return;
    }

    await safeAnswerCallback(ctx);
  } catch (err) {
    // safeAnswerCallback sudah menangani callback; error lain dijawab aman.
    await safeAnswerCallback(ctx, 'Terjadi kesalahan pada panel admin.', true);
  }
}

/**
 * Middleware pesan teks admin (jumlah token). Didaftarkan sebelum handler
 * pesan utama.
 * @param {import('grammy').Context} ctx
 * @param {() => Promise<void>} next
 */
export async function adminMessageMiddleware(ctx, next) {
  const ownerId = ctx.from?.id;
  if (!ownerId || !isOwner(ownerId)) {
    await next();
    return;
  }

  const pending = getPending(ownerId);
  if (!pending) {
    await next();
    return;
  }

  const text = (ctx.message?.text || '').trim();
  if (!text || text.startsWith('/')) {
    await next();
    return;
  }

  if (pending.action === 'awaiting_count') {
    const count = Number(text);
    if (!Number.isInteger(count) || count < 1 || count > MAX_TOKENS_PER_BATCH) {
      await ctx.reply(`Jumlah tidak valid. Kirim angka 1–${MAX_TOKENS_PER_BATCH}.`);
      return;
    }
    setPending(ownerId, { action: 'awaiting_expiry', count });
    await ctx.reply(`Jumlah: *${count} token*\n\nPilih masa berlaku token:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '7 Hari', callback_data: 'admin:expiry:7' },
            { text: '30 Hari', callback_data: 'admin:expiry:30' }
          ],
          [{ text: 'Tidak Expired', callback_data: 'admin:expiry:none' }]
        ]
      }
    });
    return;
  }

  if (pending.action === 'awaiting_employees') {
    const result = bulkImportEmployees(text, ownerId);
    clearPending(ownerId);

    const lines = [
      '✅ Impor data karyawan selesai.',
      `Ditambahkan: ${result.created}`,
      `Diperbarui: ${result.updated}`,
      `Gagal: ${result.failed.length}`
    ];

    if (result.failed.length > 0) {
      lines.push('', 'Baris gagal:');
      result.failed.slice(0, 10).forEach((failure) => lines.push(`• ${failure.reason}`));
      if (result.failed.length > 10) {
        lines.push(`… dan ${result.failed.length - 10} baris lainnya`);
      }
    }

    if (result.created + result.updated > 0) {
      lines.push('', `Total karyawan sekarang: ${countEmployees()}`);
    }

    await ctx.reply(lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{ text: '👔 Data Karyawan', callback_data: ADMIN_CALLBACK.EMPLOYEES }]]
      }
    });
    return;
  }

  if (pending.action === 'awaiting_delete_employee') {
    const nik = text.trim();
    if (!/^\d{8}$/.test(nik)) {
      await ctx.reply('NIK tidak valid. Kirim NIK 8 digit angka.');
      return;
    }
    clearPending(ownerId);
    const removed = deleteEmployee(nik);
    await ctx.reply(
      removed ? `✅ Karyawan dengan NIK ${nik} dihapus.` : `ℹ️ NIK ${nik} tidak ditemukan.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '👔 Data Karyawan', callback_data: ADMIN_CALLBACK.EMPLOYEES }]]
        }
      }
    );
    return;
  }

  await next();
}

/**
 * Berguna untuk pengujian: membersihkan state alur admin.
 */
export function clearAllAdminPending() {
  adminPending.clear();
}
