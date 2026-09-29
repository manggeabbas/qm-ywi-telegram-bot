/**
 * Alur registrasi pengguna QM-YWI (setelah token undangan valid).
 *
 * User hanya memasukkan NIK (Nomor Induk Karyawan, 8 digit). NAMA dikenali
 * otomatis dari direktori karyawan yang diisi admin. Nama tidak dapat diisi
 * manual; NIK yang tidak terdaftar akan ditolak.
 *
 * State registrasi dipulihkan dari database (kolom name/nik), sehingga
 * pengguna dapat melanjutkan setelah bot restart/redeploy.
 */

import { getUserByTelegramId, updateUser, isNikTakenByOther, USER_STATUS } from './users.js';
import { getEmployeeByNik } from './employees.js';
import { nowIso } from './db.js';
import { validateNik } from './validation.js';
import { TEXTS } from './texts.js';
import { sendMainMenu } from './menu.js';

export const REG_CALLBACKS = Object.freeze({
  CONFIRM: 'reg:confirm',
  EDIT_NIK: 'reg:edit_nik'
});

/**
 * Menentukan tahap registrasi dari data yang tersimpan.
 * @param {object|null} user
 * @returns {'NIK'|'CONFIRM'|null}
 */
export function registrationStage(user) {
  if (!user || user.status !== USER_STATUS.REGISTRATION) return null;
  if (!user.nik || !user.name) return 'NIK';
  return 'CONFIRM';
}

/**
 * Memulai alur registrasi (dipanggil setelah token valid).
 * @param {import('grammy').Context} ctx
 * @param {string|number} telegramUserId
 */
export async function beginRegistration(ctx, telegramUserId) {
  const user = getUserByTelegramId(telegramUserId);
  if (registrationStage(user) === 'CONFIRM') {
    await sendConfirmation(ctx, user);
    return;
  }
  await ctx.reply(TEXTS.REG_PROMPT_NIK);
}

/**
 * Melanjutkan registrasi saat pengguna mengirim /start di tengah proses.
 * @param {import('grammy').Context} ctx
 * @param {object} user
 */
export async function resumeRegistration(ctx, user) {
  if (registrationStage(user) === 'CONFIRM') {
    await sendConfirmation(ctx, user);
    return;
  }
  await ctx.reply(TEXTS.REG_CONTINUE_NIK);
}

/**
 * Menampilkan preview konfirmasi data registrasi.
 * @param {import('grammy').Context} ctx
 * @param {object} user
 */
export async function sendConfirmation(ctx, user) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Benar', callback_data: REG_CALLBACKS.CONFIRM }],
      [{ text: '✏️ Ubah NIK', callback_data: REG_CALLBACKS.EDIT_NIK }]
    ]
  };
  await ctx.reply(TEXTS.REG_CONFIRM(user.name, user.nik), { reply_markup: keyboard });
}

/**
 * Menangani input teks pada alur registrasi.
 * @param {import('grammy').Context} ctx
 * @param {object} user
 * @param {string} text
 */
export async function handleRegistrationText(ctx, user, text) {
  const stage = registrationStage(user);

  if (stage === 'NIK') {
    const check = validateNik(text);
    if (!check.valid) {
      await ctx.reply(TEXTS.NIK_INVALID);
      return;
    }

    if (isNikTakenByOther(check.value, user.telegramUserId)) {
      await ctx.reply(TEXTS.NIK_TAKEN);
      return;
    }

    const employee = getEmployeeByNik(check.value);
    if (!employee) {
      await ctx.reply(TEXTS.NIK_NOT_REGISTERED);
      return;
    }

    updateUser(user.telegramUserId, { nik: check.value, name: employee.name });
    const updated = getUserByTelegramId(user.telegramUserId);
    await sendConfirmation(ctx, updated);
    return;
  }

  if (stage === 'CONFIRM') {
    await sendConfirmation(ctx, user);
    return;
  }

  await ctx.reply(TEXTS.REG_PROMPT_NIK);
}

/**
 * Menangani callback inline pada alur registrasi.
 * @param {import('grammy').Context} ctx
 * @param {object} user
 * @param {string} data
 */
export async function handleRegistrationCallback(ctx, user, data) {
  if (data === REG_CALLBACKS.EDIT_NIK) {
    // Kosongkan NIK & nama agar dapat dikenali ulang dari direktori karyawan.
    updateUser(user.telegramUserId, { nik: null, name: null });
    await safeAnswerCallback(ctx, 'Silakan masukkan NIK baru Anda.');
    await ctx.reply(TEXTS.REG_PROMPT_NIK);
    return;
  }

  if (data === REG_CALLBACKS.CONFIRM) {
    const current = getUserByTelegramId(user.telegramUserId) || user;

    if (registrationStage(current) !== 'CONFIRM') {
      await safeAnswerCallback(ctx);
      await ctx.reply(TEXTS.REG_PROMPT_NIK);
      return;
    }

    if (isNikTakenByOther(current.nik, current.telegramUserId)) {
      await safeAnswerCallback(ctx, 'NIK sudah terdaftar pada akun lain.', true);
      await ctx.reply(TEXTS.NIK_TAKEN);
      return;
    }

    updateUser(current.telegramUserId, {
      status: USER_STATUS.ACTIVE,
      registered_at: nowIso()
    });

    await safeAnswerCallback(ctx, 'Registrasi berhasil!');
    await ctx.reply(TEXTS.REGISTER_SUCCESS(current.name, current.nik));
    await sendMainMenu(ctx);
    return;
  }

  await safeAnswerCallback(ctx);
}

/**
 * answerCallbackQuery yang aman (callback lama bisa sudah kedaluwarsa).
 * @param {import('grammy').Context} ctx
 * @param {string} [text]
 * @param {boolean} [showAlert]
 */
export async function safeAnswerCallback(ctx, text, showAlert = false) {
  if (!ctx.answerCallbackQuery) return;
  try {
    await ctx.answerCallbackQuery(text ? { text, show_alert: showAlert } : undefined);
  } catch {
    // Abaikan callback query yang sudah kedaluwarsa.
  }
}
