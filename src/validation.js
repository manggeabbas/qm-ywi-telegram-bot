/**
 * Modul validasi input QM-YWI Telegram Form Generator
 */

import { detectMaterial } from './material.js';
import { validateNumberingParams } from './numbering.js';

export const VALID_GRADES = ['A1', 'B', 'B1', 'R', 'S'];
export const VALID_MACHINES = ['FT', 'FJ'];

/**
 * Validasi pilihan mesin
 */
export function validateMachine(input) {
  if (!input) return { valid: false, error: 'Pilih mesin FT atau FJ.' };
  const upper = String(input).trim().toUpperCase();
  if (VALID_MACHINES.includes(upper)) {
    return { valid: true, value: upper };
  }
  return { valid: false, error: 'Mesin hanya boleh FT atau FJ.' };
}

/**
 * Validasi nomor gulungan asal dan deteksi material
 */
export function validateSourceCoil(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Nomor gulungan asal tidak boleh kosong.' };
  }
  const clean = input.trim().toUpperCase();
  const detection = detectMaterial(clean);
  if (!detection.valid) {
    return { valid: false, error: detection.error, materialCode: detection.materialCode };
  }
  return {
    valid: true,
    value: clean,
    materialCode: detection.materialCode,
    material: detection.material
  };
}

/**
 * Validasi input spesifikasi asal
 */
export function validateSpecification(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Spesifikasi tidak boleh kosong (contoh: 1.24*1524).' };
  }
  const clean = input.trim();
  if (clean.length < 3) {
    return { valid: false, error: 'Format spesifikasi terlalu pendek. Contoh format: 1.24*1524' };
  }
  return { valid: true, value: clean };
}

/**
 * Validasi jumlah gulungan
 */
export function validateCount(input) {
  const num = Number(input);
  if (!Number.isInteger(num) || num < 1) {
    return { valid: false, error: 'Jumlah gulungan harus berupa bilangan bulat positif minimal 1.' };
  }
  return { valid: true, value: num };
}

/**
 * Validasi digit awal penomoran
 */
export function validateStartDigit(input, count = 1) {
  const num = Number(input);
  if (!Number.isInteger(num) || num < 0 || num > 9) {
    return { valid: false, error: 'Digit awal penomoran harus bernilai 0 sampai 9.' };
  }
  const check = validateNumberingParams(count, num);
  if (!check.valid) {
    return { valid: false, error: check.error };
  }
  return { valid: true, value: num };
}

/**
 * Validasi pilihan grade
 */
export function validateGrade(input) {
  if (!input) return { valid: false, error: 'Grade harus dipilih (A1, B, B1, R, S).' };
  const clean = String(input).trim().toUpperCase();
  if (VALID_GRADES.includes(clean)) {
    return { valid: true, value: clean };
  }
  return { valid: false, error: `Grade tidak valid. Pilihan yang diperbolehkan: ${VALID_GRADES.join(', ')}` };
}

/**
 * Validasi main defect (cacat utama)
 */
export function validateMainDefect(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Cacat utama tidak boleh kosong (contoh: B22, R20, C13).' };
  }
  const clean = input.trim().toUpperCase();
  if (clean.length === 0) {
    return { valid: false, error: 'Cacat utama tidak boleh kosong.' };
  }
  return { valid: true, value: clean };
}

/**
 * Validasi remark
 */
export function validateRemark(input) {
  if (!input || typeof input !== 'string') {
    return { valid: true, value: '-' };
  }
  const clean = input.trim();
  if (clean.length === 0 || clean === '-') {
    return { valid: true, value: '-' };
  }
  return { valid: true, value: clean };
}

/**
 * Validasi panjang gulungan (meter)
 */
export function validateLength(input) {
  const num = Number(input);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Panjang harus berupa angka positif dalam satuan meter (contoh: 955).' };
  }
  return { valid: true, value: Math.round(num) };
}
