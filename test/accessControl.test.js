/**
 * Test access control, invite token, registrasi (NIK-first + direktori
 * karyawan), admin/owner, dan integrasi dengan Form Generator yang sudah ada.
 *
 * Menggunakan database SQLite sementara (file terpisah per proses test).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmywi-access-'));
process.env.DB_PATH = path.join(tmpDir, 'test.sqlite');
process.env.OWNER_TELEGRAM_ID = '555000';

const { bot } = await import('../src/bot.js');
const { createInviteTokens, normalizeToken } = await import('../src/invites.js');
const { getUserByTelegramId, updateUser, USER_STATUS } = await import('../src/users.js');
const { addOrUpdateEmployee, getEmployeeByNik, countEmployees } = await import('../src/employees.js');
const { TEXTS } = await import('../src/texts.js');

// ============================ HELPERS ============================

const captured = [];
let updateCounter = 1000000;
let messageIdCounter = 1;

bot.api.config.use(async (prev, method, payload) => {
  captured.push({ method, payload });
  if (method === 'sendMessage' || method === 'editMessageText') {
    return {
      ok: true,
      result: {
        message_id: messageIdCounter++,
        chat: { id: payload.chat_id ?? 1 },
        date: Math.floor(Date.now() / 1000),
        text: payload.text
      }
    };
  }
  return { ok: true, result: true };
});

function reset() {
  captured.length = 0;
}

function nextUpdateId() {
  return updateCounter++;
}

function messageUpdates() {
  return captured.filter((c) => c.method === 'sendMessage').map((c) => c.payload.text);
}

function lastMessage() {
  const list = messageUpdates();
  return list.length ? list[list.length - 1] : null;
}

function allText() {
  return captured
    .filter((c) => c.method === 'sendMessage' || c.method === 'editMessageText')
    .map((c) => c.payload.text)
    .join('\n---\n');
}

function fromUser(userId, username) {
  return { id: userId, is_bot: false, first_name: 'Tester', username: username || `user${userId}` };
}

async function sendText(userId, text, username) {
  const entities = text.startsWith('/')
    ? [{ offset: 0, length: text.length, type: 'bot_command' }]
    : undefined;
  const update = {
    update_id: nextUpdateId(),
    message: {
      message_id: messageIdCounter++,
      from: fromUser(userId, username),
      chat: { id: userId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
      ...(entities ? { entities } : {})
    }
  };
  await bot.handleUpdate(update);
}

async function sendCallback(userId, data, username) {
  const update = {
    update_id: nextUpdateId(),
    callback_query: {
      id: `cb${nextUpdateId()}`,
      from: fromUser(userId, username),
      message: {
        message_id: messageIdCounter++,
        chat: { id: userId, type: 'private' },
        date: Math.floor(Date.now() / 1000)
      },
      chat_instance: 'test-instance',
      data
    }
  };
  await bot.handleUpdate(update);
}

function newToken(createdBy = 'test') {
  return createInviteTokens({ count: 1, createdBy })[0].token;
}

function statusOf(userId) {
  const user = getUserByTelegramId(userId);
  return user ? user.status : USER_STATUS.NEW;
}

/**
 * Mendaftarkan user sampai ACTIVE: token -> NIK (dari direktori) -> konfirmasi.
 */
async function registerActiveUser(userId, { nik, name, token }) {
  addOrUpdateEmployee({ nik, name, createdBy: 'test' });
  await sendText(userId, '/start');
  await sendText(userId, token || newToken());
  await sendText(userId, nik);
  await sendCallback(userId, 'reg:confirm');
}

// ============================ TEST 1 ============================

test('1. User baru /start meminta token; token invalid ditolak; command diblokir', async () => {
  const userId = 900001;
  reset();

  await sendText(userId, '/start');
  assert.match(lastMessage(), /Akses Terbatas/);
  assert.match(lastMessage(), /token undangan/);
  assert.equal(statusOf(userId), USER_STATUS.NEW);

  reset();
  await sendText(userId, 'QMYWI-AAAA-BBBB-CCCC');
  assert.equal(lastMessage(), TEXTS.TOKEN_INVALID);

  reset();
  await sendText(userId, '/new');
  assert.match(lastMessage(), /Akses Terbatas/);
  assert.doesNotMatch(lastMessage(), /pilih mesin/i);
});

// ============================ TEST 2 ============================

test('2. Token valid -> REGISTRATION; NIK invalid/tak terdaftar ditolak; NIK valid -> nama auto -> ACTIVE', async () => {
  const userId = 900002;
  const token = newToken();
  reset();

  await sendText(userId, '/start');
  await sendText(userId, token);
  assert.equal(statusOf(userId), USER_STATUS.REGISTRATION);
  assert.match(allText(), /Token valid/);
  assert.match(lastMessage(), /NIK \(Nomor Induk Karyawan\)/);

  // /new sebelum registrasi selesai harus ditolak.
  reset();
  await sendText(userId, '/new');
  assert.match(allText(), /menyelesaikan registrasi/i);
  assert.doesNotMatch(allText(), /pilih mesin/i);

  // NIK salah format
  reset();
  await sendText(userId, '123');
  assert.equal(lastMessage(), TEXTS.NIK_INVALID);

  // NIK tidak ada di direktori karyawan -> ditolak
  reset();
  await sendText(userId, '99999999');
  assert.equal(lastMessage(), TEXTS.NIK_NOT_REGISTERED);
  assert.equal(statusOf(userId), USER_STATUS.REGISTRATION);

  // Tambah karyawan, lalu NIK dikenali otomatis
  addOrUpdateEmployee({ nik: '10000001', name: 'Budi Santoso', createdBy: 'test' });
  reset();
  await sendText(userId, '10000001');
  assert.match(lastMessage(), /KONFIRMASI DATA/);
  assert.match(lastMessage(), /Budi Santoso/);
  assert.match(lastMessage(), /10000001/);

  // Konfirmasi -> ACTIVE
  reset();
  await sendCallback(userId, 'reg:confirm');
  assert.equal(statusOf(userId), USER_STATUS.ACTIVE);
  assert.match(allText(), /Registrasi berhasil/);
  assert.match(allText(), /Selamat datang di QM-YWI/);

  // ACTIVE user /start langsung menu utama
  reset();
  await sendText(userId, '/start');
  assert.match(lastMessage(), /Selamat datang di/);
  assert.doesNotMatch(lastMessage(), /Akses Terbatas/);

  // Form Generator tetap berfungsi
  reset();
  await sendText(userId, '/new');
  assert.match(allText(), /Silakan pilih mesin/);
});

// ============================ TEST 3 ============================

test('3. Token hanya dapat dipakai satu kali', async () => {
  const userA = 900003;
  const userB = 900004;
  const token = newToken();
  reset();

  await sendText(userA, '/start');
  await sendText(userA, token);
  assert.equal(statusOf(userA), USER_STATUS.REGISTRATION);

  reset();
  await sendText(userB, '/start');
  await sendText(userB, token);
  assert.equal(statusOf(userB), USER_STATUS.NEW);
  assert.equal(lastMessage(), TEXTS.TOKEN_INVALID);
});

// ============================ TEST 4 ============================

test('4. NIK harus unik antar akun', async () => {
  const userA = 900005;
  const userB = 900006;
  const nik = '10000022';
  reset();

  await registerActiveUser(userA, { name: 'Ahmad', nik, token: newToken() });
  assert.equal(statusOf(userA), USER_STATUS.ACTIVE);

  reset();
  await sendText(userB, '/start');
  await sendText(userB, newToken());
  reset();
  await sendText(userB, nik);
  assert.equal(lastMessage(), TEXTS.NIK_TAKEN);
  assert.equal(statusOf(userB), USER_STATUS.REGISTRATION);
});

// ============================ TEST 5 ============================

test('5. Resume registrasi di tengah jalan lewat /start (tidak minta token ulang)', async () => {
  const userId = 900007;
  const token = newToken();
  reset();

  await sendText(userId, '/start');
  await sendText(userId, token);
  assert.equal(statusOf(userId), USER_STATUS.REGISTRATION);

  // Belum ada NIK -> lanjutkan minta NIK.
  reset();
  await sendText(userId, '/start');
  assert.match(lastMessage(), /belum selesai/);
  assert.match(lastMessage(), /masukkan NIK/i);
  assert.doesNotMatch(lastMessage(), /token undangan/i);

  // NIK dikenali -> saat /start berikutnya tampilkan konfirmasi.
  addOrUpdateEmployee({ nik: '10000077', name: 'Ibnu Abbas', createdBy: 'test' });
  await sendText(userId, '10000077');
  reset();
  await sendText(userId, '/start');
  assert.match(lastMessage(), /KONFIRMASI DATA/);
  assert.match(lastMessage(), /Ibnu Abbas/);
});

// ============================ TEST 6 ============================

test('6. BLOCKED ditolak; owner dapat unblock; owner daftar pengguna', async () => {
  const ownerId = 555000;
  const userId = 900008;
  reset();

  await registerActiveUser(userId, { name: 'Budi Blokir', nik: '10000033', token: newToken() });
  assert.equal(statusOf(userId), USER_STATUS.ACTIVE);

  const dbUser = getUserByTelegramId(userId);
  updateUser(userId, { status: USER_STATUS.BLOCKED });

  reset();
  await sendText(userId, '/start');
  assert.match(lastMessage(), /Akses Ditolak/);
  assert.equal(statusOf(userId), USER_STATUS.BLOCKED);

  // Non-owner yang diblokir tetap ditolak
  reset();
  await sendText(userId, '/admin');
  assert.match(lastMessage(), /Akses Ditolak/);

  reset();
  await sendText(ownerId, '/admin');
  assert.match(lastMessage(), /PANEL ADMINISTRATOR/);

  reset();
  await sendCallback(ownerId, 'admin:list_users');
  assert.match(allText(), /DAFTAR PENGGUNA/);

  reset();
  await sendCallback(ownerId, `admin:unblock:${dbUser.id}`);
  assert.equal(statusOf(userId), USER_STATUS.ACTIVE);

  reset();
  await sendText(userId, '/start');
  assert.match(lastMessage(), /Selamat datang di/);
});

// ============================ TEST 7 ============================

test('7. Non-owner (ACTIVE) /admin ditolak', async () => {
  const nonOwner = 900009;
  reset();
  await registerActiveUser(nonOwner, { name: 'Siti', nik: '10000044', token: newToken() });
  reset();
  await sendText(nonOwner, '/admin');
  assert.equal(lastMessage(), TEXTS.ADMIN_DENIED);
});

// ============================ TEST 8 ============================

test('8. Owner dapat membuat token undangan (jumlah + expiry)', async () => {
  const ownerId = 555000;
  reset();

  await sendText(ownerId, '/admin');
  await sendCallback(ownerId, 'admin:create_token');
  await sendText(ownerId, '2');
  assert.match(allText(), /Pilih masa berlaku/);

  reset();
  await sendCallback(ownerId, 'admin:expiry:none');
  assert.match(allText(), /Berhasil membuat 2 token undangan/);

  const match = allText().match(/QMYWI-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/g);
  assert.ok(match && match.length >= 2, 'harus ada minimal 2 token');

  const created = match[0];
  const newUser = 900010;
  reset();
  await sendText(newUser, '/start');
  await sendText(newUser, created);
  assert.equal(statusOf(newUser), USER_STATUS.REGISTRATION);
  assert.equal(normalizeToken(created), created);
});

// ============================ TEST 9 ============================

test('9. Idempotensi: duplicate update_id tidak diproses dua kali', async () => {
  const userId = 900011;
  reset();
  await registerActiveUser(userId, { name: 'Idem Poten', nik: '10000055', token: newToken() });

  const fixedUpdateId = 999000001;
  const update = {
    update_id: fixedUpdateId,
    message: {
      message_id: messageIdCounter++,
      from: fromUser(userId),
      chat: { id: userId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: '/start',
      entities: [{ offset: 0, length: 6, type: 'bot_command' }]
    }
  };

  reset();
  await bot.handleUpdate(update);
  await bot.handleUpdate(update);

  const sends = captured.filter((c) => c.method === 'sendMessage');
  assert.equal(sends.length, 1, 'update_id ganda hanya diproses sekali');
});

// ============================ TEST 10 ============================

test('10. Owner dapat memblokir lalu mengaktifkan kembali via panel', async () => {
  const ownerId = 555000;
  const userId = 900012;
  reset();
  await registerActiveUser(userId, { name: 'Blokir Dua', nik: '10000066', token: newToken() });
  const dbUser = getUserByTelegramId(userId);

  reset();
  await sendText(ownerId, '/admin');
  reset();
  await sendCallback(ownerId, `admin:block:${dbUser.id}`);
  assert.equal(statusOf(userId), USER_STATUS.BLOCKED);

  reset();
  await sendCallback(ownerId, `admin:unblock:${dbUser.id}`);
  assert.equal(statusOf(userId), USER_STATUS.ACTIVE);
});

// ============================ TEST 11 ============================

test('11. Owner dapat menambah data karyawan massal, melihat, dan menghapus', async () => {
  const ownerId = 555000;
  const before = countEmployees();
  reset();

  await sendText(ownerId, '/admin');
  reset();
  await sendCallback(ownerId, 'admin:employees:add');
  assert.match(allText(), /TAMBAH DATA KARYAWAN/);

  reset();
  await sendText(ownerId, '22220001,Karyawan Satu\n22220002;Karyawan Dua\nbaris-rusak');
  assert.match(allText(), /Impor data karyawan selesai/);
  assert.match(allText(), /Ditambahkan: 2/);
  assert.match(allText(), /Gagal: 1/);
  assert.equal(countEmployees(), before + 2);
  assert.equal(getEmployeeByNik('22220001').name, 'Karyawan Satu');
  assert.equal(getEmployeeByNik('22220002').name, 'Karyawan Dua');

  // Daftar karyawan
  reset();
  await sendCallback(ownerId, 'admin:employees:list');
  assert.match(allText(), /DAFTAR KARYAWAN/);
  assert.match(allText(), /22220001 — Karyawan Satu/);

  // Hapus karyawan
  reset();
  await sendCallback(ownerId, 'admin:employees:delete');
  reset();
  await sendText(ownerId, '22220002');
  assert.equal(getEmployeeByNik('22220002'), null);
});
