const session = require('express-session');
const { createApp } = require('../../app');

async function startTestServer() {
  const app = createApp({ sessionStore: new session.MemoryStore() });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

module.exports = { startTestServer };
