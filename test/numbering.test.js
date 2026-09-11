import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCoilNumbers,
  parseSourceCoilSuffix,
  validateNumberingParams
} from '../src/numbering.js';

test('Suffix Grouping & Suffix Parsing', () => {
  // HA10 group
  const parsed10 = parseSourceCoilSuffix('QH2608K2531HA10');
  assert.equal(parsed10.valid, true);
  assert.equal(parsed10.basePrefix, 'QH2608K2531HA1');
  assert.equal(parsed10.groupPrefix, 'HA1');
  assert.equal(parsed10.lastDigit, 0);

  // HA20 group
  const parsed20 = parseSourceCoilSuffix('QH2608K2531HA20');
  assert.equal(parsed20.valid, true);
  assert.equal(parsed20.basePrefix, 'QH2608K2531HA2');
  assert.equal(parsed20.groupPrefix, 'HA2');
  assert.equal(parsed20.lastDigit, 0);

  // HA30 group
  const parsed30 = parseSourceCoilSuffix('QH2608K2531HA35');
  assert.equal(parsed30.valid, true);
  assert.equal(parsed30.basePrefix, 'QH2608K2531HA3');
  assert.equal(parsed30.groupPrefix, 'HA3');
  assert.equal(parsed30.lastDigit, 5);
});

test('Numbering Generation - Contoh PRD Section 7 & 9', () => {
  // Source: QH2608K2531HA10, Count: 3, Start: 1
  // Hasil: QH2608K2531HA11, QH2608K2531HA12, QH2608K2531HA13
  const res = generateCoilNumbers('QH2608K2531HA10', 3, 1);
  assert.equal(res.valid, true);
  assert.deepEqual(res.coils, [
    'QH2608K2531HA11',
    'QH2608K2531HA12',
    'QH2608K2531HA13'
  ]);
});

test('Numbering Generation - Hanya digit terakhir berubah dan tidak menghasilkan HA110', () => {
  // Digit awal 0, count 5
  const res = generateCoilNumbers('QH2608K2531HA20', 5, 0);
  assert.equal(res.valid, true);
  assert.deepEqual(res.coils, [
    'QH2608K2531HA20',
    'QH2608K2531HA21',
    'QH2608K2531HA22',
    'QH2608K2531HA23',
    'QH2608K2531HA24'
  ]);
});

test('Numbering Validation - Tolak jika start + count - 1 > 9', () => {
  // start: 1, count: 10 -> 1 + 10 - 1 = 10 > 9
  const res1 = generateCoilNumbers('QH2608K2531HA10', 10, 1);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /Penomoran ditolak/);
  assert.match(res1.error, /HA110/);

  // start: 8, count: 3 -> 8 + 3 - 1 = 10 > 9
  const res2 = generateCoilNumbers('QH2608K2531HA10', 3, 8);
  assert.equal(res2.valid, false);
  assert.match(res2.error, /Penomoran ditolak/);
});

test('Numbering Validation - Validasi parameter batas', () => {
  // startDigit negatif
  assert.equal(validateNumberingParams(3, -1).valid, false);
  // startDigit > 9
  assert.equal(validateNumberingParams(1, 10).valid, false);
  // count <= 0
  assert.equal(validateNumberingParams(0, 1).valid, false);
  assert.equal(validateNumberingParams(-2, 1).valid, false);
  // count bukan integer
  assert.equal(validateNumberingParams(2.5, 1).valid, false);
});
