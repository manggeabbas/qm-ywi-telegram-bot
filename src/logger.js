import { config } from './config.js';

function sanitize(message) {
  if (typeof message !== 'string') {
    try {
      message = JSON.stringify(message);
    } catch {
      message = String(message);
    }
  }

  if (config.BOT_TOKEN && config.BOT_TOKEN.length > 5) {
    message = message.split(config.BOT_TOKEN).join('[REDACTED_BOT_TOKEN]');
  }
  if (config.WEBHOOK_SECRET_TOKEN && config.WEBHOOK_SECRET_TOKEN.length > 3) {
    message = message.split(config.WEBHOOK_SECRET_TOKEN).join('[REDACTED_SECRET]');
  }
  return message;
}

export const logger = {
  info(...args) {
    console.log(new Date().toISOString(), '[INFO]', ...args.map(sanitize));
  },
  warn(...args) {
    console.warn(new Date().toISOString(), '[WARN]', ...args.map(sanitize));
  },
  error(...args) {
    console.error(new Date().toISOString(), '[ERROR]', ...args.map(sanitize));
  },
  debug(...args) {
    if (process.env.DEBUG) {
      console.debug(new Date().toISOString(), '[DEBUG]', ...args.map(sanitize));
    }
  }
};
