/**
 * Modul parsing dan generator penomoran gulungan HAxx QM-YWI
 */

/**
 * Memvalidasi parameter penomoran jumlah dan digit awal
 * @param {number} count 
 * @param {number} startDigit 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNumberingParams(count, startDigit) {
  if (!Number.isInteger(count) || count < 1) {
    return {
      valid: false,
      error: 'Jumlah gulungan harus berupa bilangan bulat positif (minimal 1).'
    };
  }

  if (!Number.isInteger(startDigit) || startDigit < 0 || startDigit > 9) {
    return {
      valid: false,
      error: 'Digit awal penomoran harus bernilai antara 0 sampai 9.'
    };
  }

  const maxDigit = startDigit + count - 1;
  if (maxDigit > 9) {
    return {
      valid: false,
      error: `Penomoran ditolak: digit awal (${startDigit}) + jumlah (${count}) - 1 = ${maxDigit} (> 9).\nDigit terakhir suffix hanya boleh bernilai 0–9 agar tidak melebihi grup suffix (mencegah penomoran tidak valid seperti HA110).`
    };
  }

  return { valid: true };
}

/**
 * Mengekstrak basis prefix nomor gulungan hingga digit grup suffix HA
 * Contoh: QH2608K2531HA10 -> { basePrefix: "QH2608K2531HA1", groupPrefix: "HA1", lastDigit: 0 }
 * 
 * @param {string} sourceCoil 
 * @returns {{ valid: boolean, basePrefix?: string, groupPrefix?: string, lastDigit?: number, error?: string }}
 */
export function parseSourceCoilSuffix(sourceCoil) {
  if (!sourceCoil || typeof sourceCoil !== 'string') {
    return { valid: false, error: 'Nomor gulungan asal tidak boleh kosong.' };
  }

  const clean = sourceCoil.trim().toUpperCase();
  const match = clean.match(/^(.*HA\d)(\d)$/);

  if (!match) {
    return {
      valid: false,
      error: 'Nomor gulungan asal harus memiliki suffix format HAxx dengan 2 digit angka (contoh: QH2608K2531HA10).'
    };
  }

  return {
    valid: true,
    basePrefix: match[1], // e.g. QH2608K2531HA1
    groupPrefix: match[1].slice(-3), // e.g. HA1
    lastDigit: parseInt(match[2], 10)
  };
}

/**
 * Menghasilkan daftar nomor gulungan baru berdasarkan nomor asal, jumlah, dan digit awal
 * 
 * @param {string} sourceCoil 
 * @param {number} count 
 * @param {number} startDigit 
 * @returns {{ valid: boolean, coils?: string[], error?: string }}
 */
export function generateCoilNumbers(sourceCoil, count, startDigit) {
  const parsed = parseSourceCoilSuffix(sourceCoil);
  if (!parsed.valid) {
    return { valid: false, error: parsed.error };
  }

  const validation = validateNumberingParams(count, startDigit);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  const coils = [];
  for (let i = 0; i < count; i++) {
    const digit = startDigit + i;
    coils.push(`${parsed.basePrefix}${digit}`);
  }

  return {
    valid: true,
    coils
  };
}
