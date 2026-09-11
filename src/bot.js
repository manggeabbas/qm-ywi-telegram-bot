/**
 * QM-YWI Telegram Form Generator Bot v2.1
 * Main bot entry point, routing, webhook server & polling runner
 */

import http from 'node:http';
import { Bot, webhookCallback } from 'grammy';
import { config } from './config.js';
import { logger } from './logger.js';
import { sessions, idempotencyCache } from './state.js';
import {
  STEPS,
  startNewWizard,
  handleMachineSelection,
  handleWizardTextInput,
  handleGradeSelection,
  handleDefaultRemark,
  handleDiameterSelection,
  showFullPreview,
  generateFinalOutput,
  showEditCoilMenu,
  showEditFieldMenu,
  promptEditValue,
  handleEditCallbackValue
} from './wizard.js';
import { MATERIAL_MAP } from './material.js';

if (!config.BOT_TOKEN && process.env.NODE_ENV === 'production') {
  logger.error('CRITICAL: TELEGRAM_BOT_TOKEN is not set!');
  process.exit(1);
}

// Inisialisasi bot Grammy (dengan botInfo default untuk testing dan offline handling)
export const bot = new Bot(config.BOT_TOKEN || '000000000:DUMMY_TOKEN_FOR_TESTING', {
  botInfo: {
    id: 999000111,
    is_bot: true,
    first_name: 'QM-YWI Bot',
    username: 'qmywi_bot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false
  }
});

/**
 * Middleware: Idempotensi update_id Telegram
 * Memastikan setiap update_id diproses maksimal 1 kali untuk mencegah duplikasi webhook retry.
 */
bot.use(async (ctx, next) => {
  const updateId = ctx.update?.update_id;
  if (updateId !== undefined && updateId !== null) {
    if (idempotencyCache.has(updateId)) {
      logger.warn(`Update ${updateId} sudah pernah diproses. Mengabaikan duplicate update.`);
      return;
    }
    idempotencyCache.add(updateId);
  }
  await next();
});

// Middleware Logging
bot.use(async (ctx, next) => {
  const user = ctx.from?.username || ctx.from?.id || 'unknown';
  logger.debug(`Incoming update: from=${user}, type=${ctx.updateType}`);
  await next();
});

// ======================== COMMANDS ========================

// /start
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  const welcomeText = `${config.HEADER_TEXT}

Selamat datang di *QM-YWI Telegram Form Generator* (v${config.VERSION}).
Bot ini membantu inspector/operator membuat data gulungan baru secara bertahap, cepat, konsisten, dan meminimalkan kesalahan.

Tekan tombol di bawah atau ketik /new untuk mulai membuat form.`;

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Mulai Buat Form', callback_data: 'action:new_form' }],
        [
          { text: 'ℹ️ Referensi Material', callback_data: 'cmd:material' },
          { text: '📖 Bantuan', callback_data: 'cmd:help' }
        ]
      ]
    }
  });
});

// /new
bot.command('new', async (ctx) => {
  await startNewWizard(ctx, ctx.from.id);
});

// /help
bot.command('help', async (ctx) => {
  const helpText = `*PANDUAN PENGGUNAAN QM-YWI FORM GENERATOR*

*Perintah yang tersedia:*
/start - Menampilkan pesan pembuka dan menu awal
/new - Memulai pembuatan form gulungan baru
/help - Menampilkan panduan bantuan ini
/material - Menampilkan tabel referensi kode material (Z/K/G)
/example - Menampilkan contoh alur input dan hasil output
/cancel - Membatalkan sesi pembuatan form aktif
/about - Informasi tentang identitas QM-YWI

*Alur Pengisian:*
1. Pilih Mesin (\`FT\` atau \`FJ\`)
2. Masukkan Nomor Gulungan Asal (contoh: \`QH2608K2531HA10\`)
3. Konfirmasi deteksi material otomatis
4. Masukkan Spesifikasi (contoh: \`1.24*1524\`)
5. Masukkan Jumlah Gulungan (contoh: \`3\`)
6. Masukkan Digit Awal Suffix HA (contoh: \`1\`)
7. Preview penomoran coil hasil
8. Input data per coil: Grade (A1/B/B1/R/S), Cacat Utama, Remark, Panjang, Diameter
9. Preview seluruh data dan konfirmasi
10. Dapatkan format final Mandarin workplace QM-YWI`;

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// /material
bot.command('material', async (ctx) => {
  const materialList = Object.entries(MATERIAL_MAP)
    .map(([code, name]) => `• Kode *${code}* ➔ *${name}*`)
    .join('\n');

  const text = `*TABEL REFERENSI MATERIAL QM-YWI*\n\n${materialList}\n\n_Catatan: Kode material terletak setelah kode periode dan sebelum nomor urut utama._`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// /example
bot.command('example', async (ctx) => {
  const exampleText = `*CONTOH ALUR & OUTPUT FINAL QM-YWI*

*Contoh Input:*
• Mesin: FT
• Gulungan Asal: \`QH2608K2531HA10\` (Material: S30403)
• Spesifikasi: \`1.24*1524\`
• Jumlah: 3, Digit Awal: 1
• Coil 1: A1, B22, -, 955米, 610 (Tidak Perlu)
• Coil 2: A1, B22, -, 955米, 610 (Tidak Perlu)
• Coil 3: S, C13, -, 15米, 610 (Tidak Perlu)

*Contoh Output Final Workplace:*
\`\`\`text
机组：FT
QH2608K2531HA10
要生成新卷号

QH2608K2531HA11
S30403
1.24*1524
等级: A1
主缺陷: B22
备注: -
目前内径: 610
是否需改内径: Tidak Perlu
长度: 955米

QH2608K2531HA12
S30403
1.24*1524
等级: A1
主缺陷: B22
备注: -
目前内径: 610
是否需改内径: Tidak Perlu
长度: 955米

QH2608K2531HA13
S30403
1.24*1524
等级: S
主缺陷: C13
备注: -
目前内径: 610
是否需改内径: Tidak Perlu
长度: 15米
\`\`\``;

  await ctx.reply(exampleText, { parse_mode: 'Markdown' });
});

// /cancel
bot.command('cancel', async (ctx) => {
  const userId = ctx.from.id;
  sessions.clear(userId);
  await ctx.reply('❌ Sesi pembuatan form telah dibatalkan. Ketik /new jika ingin memulai kembali.');
});

// /about
bot.command('about', async (ctx) => {
  const text = `*${config.DEPARTMENT}*
*Divisi:* ${config.DIVISION}
*Versi:* ${config.VERSION}

_"${config.MOTTO}"_

Bot ini dirancang khusus untuk mempermudah dan memastikan kepatuhan standar pembuatan form gulungan baru QM-YWI.`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ==================== CALLBACK QUERIES ====================

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const session = sessions.get(userId);

  try {
    // Tombol info dari start menu
    if (data === 'cmd:material') {
      const materialList = Object.entries(MATERIAL_MAP)
        .map(([code, name]) => `• Kode *${code}* ➔ *${name}*`)
        .join('\n');
      await ctx.reply(`*TABEL REFERENSI MATERIAL QM-YWI*\n\n${materialList}`, { parse_mode: 'Markdown' });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data === 'cmd:help') {
      await ctx.reply('Ketik /help untuk panduan lengkap atau /new untuk memulai form baru.');
      await ctx.answerCallbackQuery();
      return;
    }

    // Aksi umum
    if (data === 'action:new_form') {
      await ctx.answerCallbackQuery();
      await startNewWizard(ctx, userId);
      return;
    }

    if (data === 'action:cancel') {
      sessions.clear(userId);
      await ctx.answerCallbackQuery({ text: 'Sesi dibatalkan' });
      await ctx.editMessageText('❌ Sesi telah dibatalkan. Ketik /new untuk mulai kembali.');
      return;
    }

    // Pemilihan Mesin
    if (data.startsWith('machine:')) {
      const machine = data.split(':')[1];
      await ctx.answerCallbackQuery();
      await handleMachineSelection(ctx, userId, machine);
      return;
    }

    if (data === 'action:back_to_machine') {
      await ctx.answerCallbackQuery();
      await startNewWizard(ctx, userId);
      return;
    }

    // Konfirmasi Material
    if (data === 'action:confirm_material') {
      sessions.set(userId, { step: STEPS.INPUT_SPECIFICATION });
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(`Nomor Gulungan: \`${session.sourceCoil}\`\nMaterial: *${session.material}*\n\nSilakan masukkan spesifikasi asal gulungan:\n(Contoh: \`1.24*1524\`)`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
        }
      });
      return;
    }

    if (data === 'action:edit_source_coil') {
      sessions.set(userId, { step: STEPS.INPUT_SOURCE_COIL });
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('Silakan masukkan kembali nomor gulungan asal:\n(Contoh: `QH2608K2531HA10`)', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
        }
      });
      return;
    }

    // Konfirmasi Penomoran
    if (data === 'action:confirm_numbering') {
      sessions.set(userId, {
        step: STEPS.INPUT_COIL_GRADE,
        currentCoilIndex: 0,
        currentCoilData: { coilNumber: session.generatedCoils[0] },
        inspections: []
      });
      await ctx.answerCallbackQuery();

      const firstCoil = session.generatedCoils[0];
      const text = `Penomoran dikonfirmasi!\n\nLanjut ke pengisian data inspeksi:\n[Coil 1 / ${session.generatedCoils.length}]: \`${firstCoil}\`\nSilakan pilih Grade:`;
      const keyboard = {
        inline_keyboard: [
          ['A1', 'B', 'B1', 'R', 'S'].map(g => ({ text: g, callback_data: `grade:${g}` })),
          [{ text: 'Batal', callback_data: 'action:cancel' }]
        ]
      };
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    }

    if (data === 'action:edit_numbering') {
      sessions.set(userId, { step: STEPS.INPUT_COUNT });
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('Silakan masukkan kembali jumlah gulungan yang akan dibuat:\n(Contoh: `3`)', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
        }
      });
      return;
    }

    // Input Grade
    if (data.startsWith('grade:')) {
      const grade = data.split(':')[1];
      await ctx.answerCallbackQuery();
      await handleGradeSelection(ctx, userId, grade);
      return;
    }

    // Input Remark Default
    if (data === 'remark:default') {
      await ctx.answerCallbackQuery();
      await handleDefaultRemark(ctx, userId);
      return;
    }

    // Input Diameter
    if (data.startsWith('diameter:')) {
      const val = data.split(':')[1];
      await ctx.answerCallbackQuery();
      await handleDiameterSelection(ctx, userId, val);
      return;
    }

    // Final Output
    if (data === 'action:generate_final') {
      await ctx.answerCallbackQuery();
      await generateFinalOutput(ctx, userId);
      return;
    }

    // Menu Edit
    if (data === 'edit:source_coil') {
      sessions.set(userId, { step: STEPS.INPUT_SOURCE_COIL });
      await ctx.answerCallbackQuery();
      await ctx.reply('Silakan masukkan nomor gulungan asal baru:\n(Contoh: `QH2608K2531HA10`)', { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'edit:specification') {
      await ctx.answerCallbackQuery();
      await promptEditValue(ctx, userId, 'specification');
      return;
    }

    if (data === 'edit:select_coil') {
      await ctx.answerCallbackQuery();
      await showEditCoilMenu(ctx, userId);
      return;
    }

    if (data.startsWith('edit_coil:')) {
      const idx = parseInt(data.split(':')[1], 10);
      await ctx.answerCallbackQuery();
      await showEditFieldMenu(ctx, userId, idx);
      return;
    }

    if (data.startsWith('edit_field:')) {
      const field = data.split(':')[1];
      await ctx.answerCallbackQuery();
      await promptEditValue(ctx, userId, field);
      return;
    }

    if (data.startsWith('edit_grade_val:')) {
      const val = data.split(':')[1];
      await handleEditCallbackValue(ctx, userId, 'grade', val);
      return;
    }

    if (data.startsWith('edit_diameter_val:')) {
      const val = data.split(':')[1];
      await handleEditCallbackValue(ctx, userId, 'diameter', val);
      return;
    }

    if (data === 'edit_remark_val:default') {
      await handleEditCallbackValue(ctx, userId, 'remark', '-');
      return;
    }

    if (data === 'action:back_to_full_preview') {
      await ctx.answerCallbackQuery();
      await showFullPreview(ctx, userId);
      return;
    }

    await ctx.answerCallbackQuery();
  } catch (err) {
    logger.error('Error in callback query handler:', err);
    await ctx.reply('Terjadi kesalahan saat memproses permintaan. Silakan ketik /cancel lalu coba lagi.');
  }
});

// ======================= TEXT MESSAGE =======================

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;

  // Lewati pesan jika diawali dengan tanda perintah "/"
  if (text.startsWith('/')) return;

  const session = sessions.get(userId);
  if (!session || session.step === STEPS.IDLE) {
    await ctx.reply('Silakan ketik /new atau /start untuk memulai form baru.');
    return;
  }

  try {
    await handleWizardTextInput(ctx, userId, text);
  } catch (err) {
    logger.error('Error in wizard text input:', err);
    await ctx.reply('Terjadi kesalahan. Silakan coba lagi atau ketik /cancel untuk membatalkan.');
  }
});

// Error handling global Grammy
bot.catch((err) => {
  logger.error('Unhandled error in bot:', err.error || err);
});

// ======================== SERVER RUNNER ========================

/**
 * Menjalankan bot via Webhook (Production)
 * @param {number} [port]
 */
export function startWebhookServer(port = config.PORT) {
  const handleUpdate = webhookCallback(bot, 'http', {
    secretToken: config.WEBHOOK_SECRET_TOKEN || undefined
  });

  const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        department: config.DEPARTMENT,
        division: config.DIVISION,
        version: config.VERSION
      }));
      return;
    }

    // Webhook endpoint
    if (req.method === 'POST' && (req.url === '/webhook' || req.url === '/')) {
      handleUpdate(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, config.HOST, async () => {
    logger.info(`QM-YWI Telegram Bot Webhook server listening on http://${config.HOST}:${port}`);
    if (config.WEBHOOK_URL && config.BOT_TOKEN) {
      try {
        await bot.api.setWebhook(config.WEBHOOK_URL, {
          secret_token: config.WEBHOOK_SECRET_TOKEN || undefined
        });
        logger.info(`Telegram Webhook set successfully to ${config.WEBHOOK_URL}`);
      } catch (err) {
        logger.error('Failed to set Telegram Webhook:', err);
      }
    }
  });

  return server;
}

/**
 * Menjalankan bot via Long Polling (Development / Testing)
 */
export async function startPolling() {
  logger.info(`Starting QM-YWI Telegram Bot in POLLING mode (v${config.VERSION})...`);
  await bot.start({
    onStart: (botInfo) => {
      logger.info(`Bot @${botInfo.username} started successfully.`);
    }
  });
}

// Inisialisasi otomatis jika file dijalankan langsung melalui `node src/bot.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  if (config.BOT_MODE === 'webhook') {
    startWebhookServer();
  } else {
    if (!config.BOT_TOKEN) {
      logger.warn('TELEGRAM_BOT_TOKEN belum diatur di .env. Memulai server Webhook lokal untuk health check...');
      startWebhookServer();
    } else {
      startPolling();
    }
  }
}
