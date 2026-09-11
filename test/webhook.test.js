import test from 'node:test';
import assert from 'node:assert/strict';
import { startWebhookServer } from '../src/bot.js';

test('Webhook Server - Health Check GET /health', async () => {
  const port = 3456;
  const server = startWebhookServer(port);

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
