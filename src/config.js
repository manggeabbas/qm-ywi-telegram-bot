import dotenv from 'dotenv';
dotenv.config();

export const config = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  WEBHOOK_SECRET_TOKEN: process.env.WEBHOOK_SECRET_TOKEN || '',
  BOT_MODE: process.env.BOT_MODE || (process.env.WEBHOOK_URL ? 'webhook' : 'polling'),

  // ===== Access Control & Persistence =====
  // Telegram User ID owner/admin (dipisahkan koma bila lebih dari satu). Wajib diisi agar /admin berfungsi.
  OWNER_TELEGRAM_IDS: (process.env.OWNER_TELEGRAM_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  // Owner utama (kompatibilitas, owner pertama)
  OWNER_TELEGRAM_ID: (process.env.OWNER_TELEGRAM_ID || '').split(',')[0]?.trim() || '',
  // Lokasi file database SQLite (gunakan ':memory:' untuk pengujian)
  DB_PATH: process.env.DB_PATH || './data/qmywi.sqlite',
  // Masa berlaku default token undangan bila tidak dipilih (hari), 0 = tidak expired
  DEFAULT_TOKEN_TTL_DAYS: parseInt(process.env.DEFAULT_TOKEN_TTL_DAYS || '0', 10),
  
  HEADER_TEXT: `Department of Quality Management\nQM-YWI\n\nPeriksa dengan teliti, Pastikan Sempurna!`,
  
  DEPARTMENT: 'Department of Quality Management',
  DIVISION: 'QM-YWI',
  MOTTO: 'Periksa dengan teliti, Pastikan Sempurna!',
  VERSION: '2.1'
};
