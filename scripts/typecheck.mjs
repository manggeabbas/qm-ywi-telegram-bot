/**
 * Pemeriksaan sintaks seluruh file sumber (pengganti typecheck karena project
 * ini JavaScript murni tanpa TypeScript).
 *
 * Menjalankan `node --check` untuk setiap file .js/.mjs di src/ dan test/.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

const files = [...walk('src'), ...walk('test')].sort();
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`SYNTAX ERROR: ${file}`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  }
}

console.log(`Checked ${files.length} file(s): ${failed === 0 ? 'OK' : `${failed} error(s)`}`);
process.exit(failed === 0 ? 0 : 1);
