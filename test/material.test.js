import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMaterial, getMaterialName, MATERIAL_MAP, UNKNOWN_MATERIAL_MESSAGE } from '../src/material.js';

test('Material Mapping - Z, K, G ke spesifikasi resmi QM-YWI', () => {
  assert.equal(getMaterialName('Z'), 'S30400');
  assert.equal(getMaterialName('K'), 'S30403');
  assert.equal(getMaterialName('G'), 'S31603');
  assert.equal(getMaterialName('z'), 'S30400');
  assert.equal(getMaterialName('k'), 'S30403');
  assert.equal(getMaterialName('g'), 'S31603');
});

test('Material Detection - Kode valid dari nomor gulungan', () => {
  const coilK = detectMaterial('QH2608K1234HA10');
  assert.equal(coilK.valid, true);
  assert.equal(coilK.materialCode, 'K');
  assert.equal(coilK.material, 'S30403');

  const coilZ = detectMaterial('QH2608Z1234HA10');
  assert.equal(coilZ.valid, true);
  assert.equal(coilZ.materialCode, 'Z');
  assert.equal(coilZ.material, 'S30400');

  const coilG = detectMaterial('QH2608G1234HA10');
  assert.equal(coilG.valid, true);
  assert.equal(coilG.materialCode, 'G');
  assert.equal(coilG.material, 'S31603');

  // Case insensitive
  const coilLower = detectMaterial('qh2608k2531ha10');
  assert.equal(coilLower.valid, true);
  assert.equal(coilLower.materialCode, 'K');
  assert.equal(coilLower.material, 'S30403');
});

test('Material Detection - Kode tidak dikenal ditolak dan tidak menebak', () => {
  const invalidCoil = detectMaterial('QH2608X1234HA10');
  assert.equal(invalidCoil.valid, false);
  assert.equal(invalidCoil.materialCode, 'X');
  assert.equal(invalidCoil.error, UNKNOWN_MATERIAL_MESSAGE);
  assert.match(invalidCoil.error, /Kode jenis\/material tidak dikenali/);
  assert.match(invalidCoil.error, /Z = S30400/);
  assert.match(invalidCoil.error, /K = S30403/);
  assert.match(invalidCoil.error, /G = S31603/);
});

test('Material Detection - Format nomor gulungan tidak valid', () => {
  const noHA = detectMaterial('QH2608K1234');
  assert.equal(noHA.valid, false);
  assert.match(noHA.error, /suffix HA/);

  const empty = detectMaterial('');
  assert.equal(empty.valid, false);
});
