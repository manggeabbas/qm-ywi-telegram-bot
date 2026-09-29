/**
 * Access guard QM-YWI.
 *
 * Semua update dari user wajib melewati guard ini sebelum menyentuh fitur
 * Form Generator maupun command lainnya.
 *
 *   Telegram Update -> Get User ID -> Get Status
 *     NEW          -> invitation flow saja
 *     REGISTRATION -> registration flow saja
 *     ACTIVE       -> bot normal (diteruskan)
 *     BLOCKED      -> ditolak
 *
 * Owner (OWNER_TELEGRAM_ID) dikecualikan agar selalu dapat mengakses /admin.
 */

import { config } from './config.js';
import { getUserByTelegramId, USER_STATUS } from './users.js';
import { TEXTS } from './texts.js';
import { sendInvitePrompt, handleTokenInput } from './invites.js';
import {
  resumeRegistration,
  handleRegistrationText,
  handleRegistrationCallback,
  safeAnswerCallback
} from './registration.js';

/**
 * Cek apakah Telegram User ID termasuk owner.
 * @param {string|number} telegramUserId
 */
export function isOwner(telegramUserId) {
  if (telegramUserId === undefined || telegramUserId === null) return false;
  return config.OWNER_TELEGRAM_IDS.includes(String(telegramUserId).trim());
}

/**
 * Middleware access guard grammY.
 * @param {import('grammy').Context} ctx
 * @param {() => Promise<void>} next
 */
export async function accessGuard(ctx, next) {
  const from = ctx.from;
  if (!from || from.is_bot) {
    await next();
    return;
  }

  const telegramUserId = from.id;

  // Owner selalu diizinkan (agar tidak terkunci dari /admin).
  if (isOwner(telegramUserId)) {
    await next();
    return;
  }

  const user = getUserByTelegramId(telegramUserId);
  const status = user ? user.status : USER_STATUS.NEW;

  if (status === USER_STATUS.BLOCKED) {
    if (ctx.callbackQuery) await safeAnswerCallback(ctx);
    await ctx.reply(TEXTS.BLOCKED);
    return;
  }

  if (status === USER_STATUS.ACTIVE) {
    await next();
    return;
  }

  const text = (ctx.message?.text || '').trim();
  const data = ctx.callbackQuery?.data || '';
  const isCommand = text.startsWith('/');
  const command = isCommand ? text.split(/\s+/)[0].replace(/^\/+/, '').split('@')[0].toLowerCase() : '';

  // /start sadar-status: lanjutkan flow yang sesuai.
  if (isCommand && command === 'start') {
    if (status === USER_STATUS.REGISTRATION && user) {
      await resumeRegistration(ctx, user);
    } else {
      await sendInvitePrompt(ctx);
    }
    return;
  }

  if (status === USER_STATUS.NEW) {
    // Hanya boleh memasukkan token undangan.
    if (ctx.callbackQuery) {
      await safeAnswerCallback(ctx, 'Silakan masukkan token undangan Anda terlebih dahulu.');
      await sendInvitePrompt(ctx);
      return;
    }
    if (text && !isCommand) {
      await handleTokenInput(ctx, text, from);
      return;
    }
    await sendInvitePrompt(ctx);
    return;
  }

  if (status === USER_STATUS.REGISTRATION && user) {
    // Hanya boleh menyelesaikan registrasi.
    if (ctx.callbackQuery) {
      if (data.startsWith('reg:')) {
        await handleRegistrationCallback(ctx, user, data);
      } else {
        await safeAnswerCallback(ctx, TEXTS.RESTRICTED_REGISTRATION);
        await resumeRegistration(ctx, user);
      }
      return;
    }
    if (text && !isCommand) {
      await handleRegistrationText(ctx, user, text);
      return;
    }
    await ctx.reply(TEXTS.RESTRICTED_REGISTRATION);
    await resumeRegistration(ctx, user);
    return;
  }

  // Fallback defensif.
  await sendInvitePrompt(ctx);
}
