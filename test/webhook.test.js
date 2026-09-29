import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmywi-webhook-'));
process.env.DB_PATH = path.join(tmpDir, 'test.sqlite');

const { startWebhookServer } = await import('../src/bot.js');

after(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // abaikan
  }
});

test('Webhook Server - Health Check GET /health', async () => {
  const port = 3456;
  // setWebhook: false -> test TIDAK boleh mengubah webhook Telegram production.
  const server = startWebhookServer(port, { setWebhook: false });

  try {
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fetch('http://127.0.0.1:3456/health');
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.division, 'QM-YWI');
    assert.equal(data.version, '2.1');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
