/**
 * Menu utama QM-YWI (digunakan setelah user ACTIVE / owner).
 * Dipisahkan agar dapat dipakai ulang oleh alur registrasi.
 */

import { config } from './config.js';

export function mainMenuText() {
  return `${config.HEADER_TEXT}

Selamat datang di *QM-YWI Telegram Form Generator* (v${config.VERSION}).
Bot ini membantu inspector/operator membuat data gulungan baru secara bertahap, cepat, konsisten, dan meminimalkan kesalahan.

Tekan tombol di bawah atau ketik /new untuk mulai membuat form.`;
}

export function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Mulai Buat Form', callback_data: 'action:new_form' }],
      [
        { text: 'ℹ️ Referensi Material', callback_data: 'cmd:material' },
        { text: '📖 Bantuan', callback_data: 'cmd:help' }
      ]
    ]
  };
}

/**
 * Menampilkan menu utama ke chat.
 * @param {import('grammy').Context} ctx
 */
export async function sendMainMenu(ctx) {
  await ctx.reply(mainMenuText(), {
    parse_mode: 'Markdown',
    reply_markup: mainMenuKeyboard()
  });
}
