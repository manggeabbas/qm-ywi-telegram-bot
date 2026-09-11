import test from 'node:test';
import assert from 'node:assert/strict';
import { idempotencyCache, sessions, createInitialState } from '../src/state.js';

test('Idempotency Cache - Menolak update_id ganda', () => {
  idempotencyCache.clear();

  const updateId = 123456789;
  assert.equal(idempotencyCache.has(updateId), false);

  idempotencyCache.add(updateId);
  assert.equal(idempotencyCache.has(updateId), true);

  // Penambahan kedua tidak error dan tetap terdeteksi sudah diproses
  idempotencyCache.add(updateId);
  assert.equal(idempotencyCache.has(updateId), true);
});

test('Idempotency Cache - Batas kapasitas cache LRU', () => {
  const smallCache = new (idempotencyCache.constructor)(5);
  for (let i = 1; i <= 6; i++) {
    smallCache.add(i);
  }

  // Id 1 harus tereliminasi karena kapasitas 5
  assert.equal(smallCache.has(1), false);
  assert.equal(smallCache.has(2), true);
  assert.equal(smallCache.has(6), true);
});

test('Session Store - Inisialisasi, update, dan reset sesi', () => {
  const userId = 999888;
  sessions.clear(userId);

  const initial = sessions.get(userId);
  assert.equal(initial.step, 'IDLE');
  assert.deepEqual(initial.inspections, []);

  sessions.set(userId, { machine: 'FT', step: 'INPUT_SOURCE_COIL' });
  const updated = sessions.get(userId);
  assert.equal(updated.machine, 'FT');
  assert.equal(updated.step, 'INPUT_SOURCE_COIL');

  sessions.clear(userId);
  assert.equal(sessions.has(userId), false);
});
