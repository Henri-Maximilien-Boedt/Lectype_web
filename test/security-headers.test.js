const test = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('./helpers/server');

test('pages carry strict security headers', async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.base}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
  } finally {
    await server.close();
  }
});

test('unknown pages return 404', async () => {
  const server = await startTestServer();
  try {
    assert.equal((await fetch(`${server.base}/nope`)).status, 404);
  } finally {
    await server.close();
  }
});

test('posting without a CSRF token is refused', async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.base}/language`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'lang=en', redirect: 'manual',
    });
    assert.equal(response.status, 403);
  } finally {
    await server.close();
  }
});
