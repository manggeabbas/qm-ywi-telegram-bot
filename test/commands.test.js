import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Siapkan database sementara SEBELUM modul bot diimpor.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmywi-commands-'));
process.env.DB_PATH = path.join(tmpDir, 'test.sqlite');
process.env.OWNER_TELEGRAM_ID = '';

const { bot } = await import('../src/bot.js');
const { sessions } = await import('../src/state.js');
const { createUser, updateUser } = await import('../src/users.js');

after(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // abaikan
  }
});

test('Bot Commands - /start, /help, /material, /example, /about, /cancel (user ACTIVE)', async () => {
  const userId = 777111;
  const chatId = 777111;

  // User harus ACTIVE agar dapat mengakses command fitur (access control).
  createUser({ telegramUserId: userId, telegramUsername: 'testuser', status: 'ACTIVE' });
  updateUser(userId, { name: 'Inspector Test', nik: '12345678' });

  const responses = [];

  // Gunakan API transformer grammY untuk menangkap semua panggilan sendMessage
  bot.api.config.use(async (prev, method, payload) => {
    if (method === 'sendMessage') {
      responses.push(payload);
      return {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 10000),
          chat: { id: payload.chat_id },
          date: Math.floor(Date.now() / 1000),
          text: payload.text
        }
      };
    }
    return { ok: true, result: true };
  });

  async function sendMockCommand(commandText) {
    const update = {
      update_id: Math.floor(Math.random() * 10000000),
      message: {
        message_id: Math.floor(Math.random() * 10000),
        from: { id: userId, is_bot: false, first_name: 'Inspector', username: 'testuser' },
        chat: { id: chatId, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: commandText,
        entities: [{ offset: 0, length: commandText.length, type: 'bot_command' }]
      }
    };
    await bot.handleUpdate(update);
  }

  // 1. Test /start
  responses.length = 0;
  await sendMockCommand('/start');
  assert.ok(responses.length > 0);
  assert.match(responses[0].text, /Department of Quality Management/);
  assert.match(responses[0].text, /Periksa dengan teliti, Pastikan Sempurna!/);

  // 2. Test /help
  responses.length = 0;
  await sendMockCommand('/help');
  assert.ok(responses.length > 0);
  assert.match(responses[0].text, /PANDUAN PENGGUNAAN QM-YWI/);

  // 3. Test /material
  responses.length = 0;
  await sendMockCommand('/material');
  assert.ok(responses.length > 0);
  assert.match(responses[0].text, /S30400/);
  assert.match(responses[0].text, /S30403/);
  assert.match(responses[0].text, /S31603/);

  // 4. Test /example
  responses.length = 0;
  await sendMockCommand('/example');
  assert.ok(responses.length > 0);
  assert.match(responses[0].text, /机组：FT/);
  assert.match(responses[0].text, /QH2608K2531HA10/);

  // 5. Test /about
  responses.length = 0;
  await sendMockCommand('/about');
  assert.ok(responses.length > 0);
  assert.match(responses[0].text, /QM-YWI/);
  assert.match(responses[0].text, /Periksa dengan teliti, Pastikan Sempurna!/);

  // 6. Test /cancel
  responses.length = 0;
  sessions.set(userId, { machine: 'FT', step: 'INPUT_SOURCE_COIL' });
  assert.equal(sessions.has(userId), true);
  await sendMockCommand('/cancel');
  assert.ok(responses.length > 0);
  assert.match(responses[0].text, /dibatalkan/);
  assert.equal(sessions.has(userId), false);
});
