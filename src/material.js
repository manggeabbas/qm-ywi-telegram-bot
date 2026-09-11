/**
 * Modul deteksi dan mapping jenis material QM-YWI
 */

export const MATERIAL_MAP = {
  Z: 'S30400',
  K: 'S30403',
  G: 'S31603'
};

export const UNKNOWN_MATERIAL_MESSAGE = `Kode jenis/material tidak dikenali.

Z = S30400
K = S30403
G = S31603

Silakan periksa kembali nomor gulungan.`;

/**
 * Mendapatkan nama material dari kode huruf
 * @param {string} code 
 * @returns {string|null}
 */
export function getMaterialName(code) {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return MATERIAL_MAP[upper] || null;
}

/**
 * Mendeteksi kode material dan nama material dari nomor gulungan
 * Format contoh: QH2608K1234HA10
 * Huruf material berada setelah kode periode (misal 2608) dan sebelum nomor urut utama (misal 1234).
 * 
 * @param {string} coilNumber 
 * @returns {{ valid: boolean, materialCode?: string, material?: string, error?: string }}
 */
export function detectMaterial(coilNumber) {
  if (!coilNumber || typeof coilNumber !== 'string') {
    return {
      valid: false,
      error: 'Nomor gulungan tidak boleh kosong.'
    };
  }

  const cleanCoil = coilNumber.trim().toUpperCase();

  // Pattern: [Prefix huruf][Periode digit][Kode Material Huruf][Nomor urut digit][HA][2 digit suffix]
  // Contoh: QH + 2608 + K + 2531 + HA + 10
  const match = cleanCoil.match(/^([A-Z]+\d+)([A-Z])(\d+)(HA\d{2})$/);

  if (!match) {
    // Cek apakah format suffix HAxx ada
    if (!cleanCoil.includes('HA')) {
      return {
        valid: false,
        error: 'Nomor gulungan harus memiliki suffix HA (contoh: QH2608K2531HA10).'
      };
    }

    // Cek pattern umum jika prefix berbeda
    const fallbackMatch = cleanCoil.match(/^(.+?)([A-Z])(\d+)(HA\d{2})$/);
    if (!fallbackMatch) {
      return {
        valid: false,
        error: 'Format nomor gulungan tidak valid. Contoh format: QH2608K2531HA10'
      };
    }

    const materialCode = fallbackMatch[2];
    const material = getMaterialName(materialCode);

    if (!material) {
      return {
        valid: false,
        materialCode,
        error: UNKNOWN_MATERIAL_MESSAGE
      };
    }

    return {
      valid: true,
      materialCode,
      material
    };
  }

  const materialCode = match[2];
  const material = getMaterialName(materialCode);

  if (!material) {
    return {
      valid: false,
      materialCode,
      error: UNKNOWN_MATERIAL_MESSAGE
    };
  }

  return {
    valid: true,
    materialCode,
    material
  };
}
