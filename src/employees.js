/**
 * Direktori karyawan QM-YWI.
 *
 * Diisi oleh owner/admin: pemetaan NIK (Nomor Induk Karyawan, 8 digit) ke NAMA.
 * Saat registrasi, user hanya memasukkan NIK dan NAMA dikenali otomatis dari
 * direktori ini.
 */

import { db, nowIso, withTransaction } from './db.js';
import { validateName, validateNik } from './validation.js';

const MAX_LIST = 100;

/**
 * @param {any} row
 */
function rowToEmployee(row) {
  if (!row) return null;
  return {
    id: row.id,
    nik: row.nik,
    name: row.name,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Mengambil karyawan berdasarkan NIK.
 * @param {string} nik
 */
export function getEmployeeByNik(nik) {
  if (!nik) return null;
  const row = db.prepare('SELECT * FROM employees WHERE nik = ?').get(String(nik).trim());
  return rowToEmployee(row);
}

/**
 * Menambah atau memperbarui data karyawan berdasarkan NIK.
 * @param {{ nik: string, name: string, createdBy?: string|number }} data
 * @returns {{ created: boolean, updated: boolean }}
 */
export function addOrUpdateEmployee({ nik, name, createdBy = null }) {
  const now = nowIso();
  const existing = getEmployeeByNik(nik);

  if (existing) {
    db.prepare('UPDATE employees SET name = ?, created_by = ?, updated_at = ? WHERE nik = ?').run(
      name,
      createdBy === null ? existing.createdBy : String(createdBy),
      now,
      nik
    );
    return { created: false, updated: true };
  }

  db.prepare(
    `INSERT INTO employees (nik, name, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(nik, name, createdBy === null ? null : String(createdBy), now, now);

  return { created: true, updated: false };
}

/**
 * Menguraikan satu baris input menjadi { nik, name }.
 * Mendukung format: "12345678,Nama", "12345678;Nama", "12345678<TAB>Nama",
 * atau "12345678 Nama Panjang".
 * @param {string} line
 * @returns {{ nik?: string, name?: string, error?: string }}
 */
export function parseEmployeeLine(line) {
  const raw = String(line).trim();
  if (!raw) return { error: 'Baris kosong.' };

  let nik = null;
  let name = null;

  const withSeparator = raw.match(/^(\d{8})\s*[,;\t]\s*(.+)$/);
  if (withSeparator) {
    nik = withSeparator[1];
    name = withSeparator[2];
  } else {
    const withSpace = raw.match(/^(\d{8})\s+(.+)$/);
    if (withSpace) {
      nik = withSpace[1];
      name = withSpace[2];
    }
  }

  if (!nik) {
    return { error: `Format tidak valid (butuh "NIK,Nama"): "${raw}"` };
  }

  const nikCheck = validateNik(nik);
  if (!nikCheck.valid) {
    return { error: `NIK tidak valid (harus 8 digit): "${nik}"` };
  }

  const nameCheck = validateName(name);
  if (!nameCheck.valid) {
    return { error: `Nama tidak valid: "${raw}"` };
  }

  return { nik: nikCheck.value, name: nameCheck.value };
}

/**
 * Impor massal data karyawan dari teks (satu karyawan per baris).
 * @param {string} text
 * @param {string|number} createdBy
 * @returns {{ created: number, updated: number, failed: Array<{ line: string, reason: string }> }}
 */
export function bulkImportEmployees(text, createdBy) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const result = { created: 0, updated: 0, failed: [] };

  withTransaction(() => {
    for (const line of lines) {
      const parsed = parseEmployeeLine(line);
      if (parsed.error) {
        result.failed.push({ line, reason: parsed.error });
        continue;
      }
      const outcome = addOrUpdateEmployee({
        nik: parsed.nik,
        name: parsed.name,
        createdBy
      });
      if (outcome.created) result.created += 1;
      if (outcome.updated) result.updated += 1;
    }
  });

  return result;
}

/**
 * Daftar karyawan.
 * @param {number} limit
 */
export function listEmployees(limit = MAX_LIST) {
  const rows = db.prepare('SELECT * FROM employees ORDER BY name ASC LIMIT ?').all(limit);
  return rows.map(rowToEmployee);
}

/**
 * Menghitung total karyawan.
 */
export function countEmployees() {
  const row = db.prepare('SELECT COUNT(*) AS total FROM employees').get();
  return Number(row?.total || 0);
}

/**
 * Menghapus karyawan berdasarkan NIK.
 * @param {string} nik
 * @returns {boolean}
 */
export function deleteEmployee(nik) {
  const result = db.prepare('DELETE FROM employees WHERE nik = ?').run(String(nik).trim());
  return result.changes > 0;
}
