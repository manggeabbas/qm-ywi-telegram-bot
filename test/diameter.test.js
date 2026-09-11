import test from 'node:test';
import assert from 'node:assert/strict';
import { getDiameterPrompt, resolveDiameter, DIAMETER_CONSTANTS } from '../src/diameter.js';

test('Diameter FT - Default 610 dan Pilihan Ubah 508', () => {
  const prompt = getDiameterPrompt('FT');
  assert.equal(prompt.machine, 'FT');
  assert.match(prompt.question, /目前内径: 610/);
  assert.match(prompt.question, /Apakah perlu ubah diameter menjadi 508/);

  // Jika Tidak Perlu
  const resNo = resolveDiameter('FT', 'Tidak Perlu');
  assert.equal(resNo.diameter, 610);
  assert.equal(resNo.changeDiameter, 'Tidak Perlu');

  // Jika Perlu Ubah Diameter 508
  const resYes = resolveDiameter('FT', DIAMETER_CONSTANTS.FT_CHANGE_YES);
  assert.equal(resYes.diameter, 610);
  assert.equal(resYes.changeDiameter, 'Perlu Ubah Diameter 508');
});

test('Diameter FJ - Pilihan 610 atau 508, ubah diameter selalu Tidak Perlu', () => {
  const prompt = getDiameterPrompt('FJ');
  assert.equal(prompt.machine, 'FJ');
  assert.deepEqual(prompt.options.map(o => o.value), [610, 508]);

  // Pilihan 610
  const res610 = resolveDiameter('FJ', 610);
  assert.equal(res610.diameter, 610);
  assert.equal(res610.changeDiameter, 'Tidak Perlu');

  // Pilihan 508
  const res508 = resolveDiameter('FJ', 508);
  assert.equal(res508.diameter, 508);
  assert.equal(res508.changeDiameter, 'Tidak Perlu');
});
