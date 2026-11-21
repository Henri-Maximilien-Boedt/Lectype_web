const test = require('node:test');
const assert = require('node:assert');
const { promisify } = require('util');

process.env.DATABASE_URL ??= ':memory:';
const db = require('../tools/db');
const { LibsqlSessionStore, DEFAULT_LIFETIME_MS } = require('../tools/session-store');

let now = 1_800_000_000_000;
const store = new LibsqlSessionStore({ now: () => now });
const get = promisify(store.get.bind(store));
const set = promisify(store.set.bind(store));
const touch = promisify(store.touch.bind(store));
const destroy = promisify(store.destroy.bind(store));

test.before(async () => { await db.ensureSchema(); });

test('a session is saved, read back and destroyed', async () => {
  await set('a', { cookie: {}, user: { id: 1 } });
  assert.deepEqual((await get('a')).user, { id: 1 });
  await destroy('a');
  assert.equal(await get('a'), null);
});

test('a session follows the cookie expiry', async () => {
  await set('b', { cookie: { expires: new Date(now + 30 * 24 * 3600 * 1000).toISOString() } });
  now += 29 * 24 * 3600 * 1000;
  assert.ok(await get('b'));
  now += 2 * 24 * 3600 * 1000;
  assert.equal(await get('b'), null);
});

test('a browser-session cookie lasts a day after the last activity', async () => {
  await set('c', { cookie: {} });
  now += DEFAULT_LIFETIME_MS - 1000;
  await touch('c', { cookie: {} });
  now += DEFAULT_LIFETIME_MS - 1000;
  assert.ok(await get('c'));
  now += 2000;
  assert.equal(await get('c'), null);
});

test('expired sessions are removed in bulk', async () => {
  await set('d', { cookie: {} });
  now += DEFAULT_LIFETIME_MS + 1;
  await store.removeExpired();
  const count = (await db.execute({ sql: 'SELECT COUNT(*) AS n FROM sessions WHERE sid = ?', args: ['d'] })).rows[0].n;
  assert.equal(Number(count), 0);
});
