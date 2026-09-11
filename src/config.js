import dotenv from 'dotenv';
dotenv.config();

export const config = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  WEBHOOK_SECRET_TOKEN: process.env.WEBHOOK_SECRET_TOKEN || '',
  BOT_MODE: process.env.BOT_MODE || (process.env.WEBHOOK_URL ? 'webhook' : 'polling'),
  
  HEADER_TEXT: `Department of Quality Management\nQM-YWI\n\nPeriksa dengan teliti, Pastikan Sempurna!`,
  
  DEPARTMENT: 'Department of Quality Management',
  DIVISION: 'QM-YWI',
  MOTTO: 'Periksa dengan teliti, Pastikan Sempurna!',
  VERSION: '2.1'
};
