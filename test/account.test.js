const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { startTestServer, Browser, lastEmailTo } = require('./helpers/server');
const db = require('../tools/db');
const { mergeLearning, cleanSession } = require('../tools/progress');

const PASSWORD = 'trois chats sur la lune';
let server;
let counter = 0;

test.before(async () => { server = await startTestServer(); });
test.after(async () => { await server.close(); });

function tokenIn(message) {
  return message.text.match(/token=([A-Za-z0-9_-]+)/)[1];
}

async function loggedIn() {
  counter += 1;
  const email = `compte${counter}@exemple.fr`;
  const browser = new Browser(server.base);
  await browser.post('/signup', { firstName: 'Noé', email, password: PASSWORD, confirm: PASSWORD }, '/signup');
  await browser.request(`/verify?token=${tokenIn(lastEmailTo(email))}`);
  await browser.post('/login', { email, password: PASSWORD });
  const user = (await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })).rows[0];
  return { email, browser, userID: Number(user.id) };
}

function session(overrides = {}) {
  return {
    id: crypto.randomUUID(), activity: 'book', itemID: 'contes-perrault', title: 'Contes', startedAt: '2026-11-20T10:00:00.000Z',
    activeDuration: 60, correctCharacters: 200, totalKeystrokes: 210, correctKeystrokes: 200, details: { missedCharacters: { e: 2 } }, ...overrides,
  };
}

test('learning progress merges without losing stars or counting twice', () => {
  const saved = { records: { a: { stars: 2, bestWordsPerMinute: 30, missedCharacters: { f: 3 } } } };
  const incoming = { records: { a: { stars: 1, bestWordsPerMinute: 40, missedCharacters: { f: 3, j: 1 } }, b: { stars: 1, bestWordsPerMinute: 10, missedCharacters: {} } } };
  const merged = mergeLearning(saved, incoming);
  assert.deepEqual(merged.records.a, { stars: 2, bestWordsPerMinute: 40, missedCharacters: { f: 3, j: 1 } });
  assert.deepEqual(mergeLearning(merged, incoming), merged);
});

test('invalid sessions are rejected', () => {
  assert.equal(cleanSession(session({ id: 'not-a-uuid' })), null);
  assert.equal(cleanSession(session({ activity: 'hack' })), null);
  assert.equal(cleanSession(session({ itemID: '../etc' })), null);
  assert.equal(cleanSession(session({ activeDuration: -1 })), null);
  assert.equal(cleanSession(session({ details: { big: 'x'.repeat(70000) } })), null);
  assert.ok(cleanSession(session()));
});

test('the sync API needs a logged-in user and a CSRF token', async () => {
  const anonymous = new Browser(server.base);
  assert.equal((await anonymous.json('/api/sync', {})).status, 401);
  const { browser } = await loggedIn();
  const response = await browser.request('/api/sync', { method: 'POST', json: {} });
  assert.equal(response.status, 403);
});

test('browser progress is transferred to the account and shared with another device', async () => {
  const { email, browser } = await loggedIn();
  const first = session();
  const sent = await browser.json('/api/sync', {
    bookmarks: { 'book:contes-perrault': { chapter: 2, page: 1, updatedAt: '2026-11-20T10:00:00.000Z' }, 'evil:x': { updatedAt: '2026-11-20T10:00:00.000Z' } },
    learning: { azerty: { records: { 'home-index': { stars: 3, bestWordsPerMinute: 25, missedCharacters: { f: 1 } } } } },
    sessions: [first, { id: 'bad' }],
    cursor: 0,
  });
  assert.equal(sent.status, 200);
  assert.deepEqual(Object.keys(sent.body.bookmarks), ['book:contes-perrault']);
  assert.equal(sent.body.sessions.length, 1);
  const other = new Browser(server.base);
  await other.post('/login', { email, password: PASSWORD });
  const older = await other.json('/api/sync', {
    bookmarks: { 'book:contes-perrault': { chapter: 1, page: 1, updatedAt: '2026-11-19T10:00:00.000Z' } },
    sessions: [first], cursor: 0,
  });
  assert.equal(older.body.bookmarks['book:contes-perrault'].chapter, 2);
  assert.equal(older.body.learning.azerty.records['home-index'].stars, 3);
  assert.equal(older.body.sessions.length, 1);
  const later = await other.json('/api/sync', { cursor: older.body.cursor });
  assert.equal(later.body.sessions.length, 0);
});

test('changing the email needs the password, a confirmation from the new address and warns the old one', async () => {
  const { email, browser } = await loggedIn();
  const wrong = await browser.post('/account/email', { email: 'nouvelle@exemple.fr', currentPassword: 'pas le bon mot de passe' }, '/account');
  assert.equal(wrong.status, 401);
  await browser.post('/account/email', { email: 'nouvelle@exemple.fr', currentPassword: PASSWORD }, '/account');
  assert.match(lastEmailTo(email).subject, /Changement|change/i);
  const token = tokenIn(lastEmailTo('nouvelle@exemple.fr'));
  assert.equal((await new Browser(server.base).request(`/account/email/confirm?token=${token}`)).status, 200);
  const user = (await db.execute({ sql: 'SELECT email FROM users WHERE email = ?', args: ['nouvelle@exemple.fr'] })).rows[0];
  assert.ok(user);
  assert.equal((await new Browser(server.base).request(`/account/email/confirm?token=${token}`)).status, 400);
});

test('changing the password keeps this device and logs out the others', async () => {
  const { email, browser, userID } = await loggedIn();
  const other = new Browser(server.base);
  await other.post('/login', { email, password: PASSWORD });
  const newPassword = 'des girafes dans le metro';
  const changed = await browser.post('/account/password', { currentPassword: PASSWORD, password: newPassword, confirm: newPassword }, '/account');
  assert.equal(changed.status, 200);
  assert.match((await browser.request('/account')).text, /Noé/);
  assert.equal((await other.request('/account')).status, 303);
  const count = (await db.execute({ sql: 'SELECT COUNT(*) AS n FROM devices WHERE user_id = ?', args: [userID] })).rows[0].n;
  assert.equal(Number(count), 1);
});

test('a device can be logged out from the account page', async () => {
  const { email, browser, userID } = await loggedIn();
  const other = new Browser(server.base);
  await other.post('/login', { email, password: PASSWORD });
  const devices = (await db.execute({ sql: 'SELECT id, session_id FROM devices WHERE user_id = ?', args: [userID] })).rows;
  const target = devices.find((device) => device.session_id !== browser.sessionID.split('.')[0].replace(/^s%3A/, ''));
  await browser.post(`/account/devices/${target.id}`, {}, '/account');
  assert.equal((await other.request('/account')).status, 303);
  assert.equal((await browser.request('/account')).status, 200);
});

test('the export contains the data but never the password hash', async () => {
  const { browser } = await loggedIn();
  await browser.json('/api/sync', { sessions: [session()] });
  const response = await browser.request('/account/export');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  const data = JSON.parse(response.text);
  assert.equal(data.progress.sessions.length, 1);
  assert.doesNotMatch(response.text, /\$2[aby]\$/);
  assert.doesNotMatch(response.text, /password/i);
});

test('deleting the account needs the password and the checkbox, then erases everything', async () => {
  const { email, browser, userID } = await loggedIn();
  await browser.json('/api/sync', { sessions: [session()] });
  assert.equal((await browser.post('/account/delete', { currentPassword: 'mauvais mot de passe', confirmDelete: 'on' }, '/account')).status, 401);
  assert.equal((await browser.post('/account/delete', { currentPassword: PASSWORD }, '/account')).status, 400);
  const deleted = await browser.post('/account/delete', { currentPassword: PASSWORD, confirmDelete: 'on' }, '/account');
  assert.equal(deleted.status, 200);
  assert.match(deleted.text, /data-clear-local/);
  for (const table of ['users', 'profiles', 'devices', 'email_tokens']) {
    const column = table === 'users' ? 'id' : 'user_id';
    const count = (await db.execute({ sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, args: [userID] })).rows[0].n;
    assert.equal(Number(count), 0, table);
  }
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM typing_sessions WHERE profile_id NOT IN (SELECT id FROM profiles)')).rows[0].n), 0);
  assert.equal((await new Browser(server.base).post('/login', { email, password: PASSWORD })).status, 401);
});

test('every security event has a label in both languages', () => {
  const fs = require('fs');
  const path = require('path');
  const sources = ['auth.js', 'account.js'].map((file) => fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8')).join('\n');
  const events = [...sources.matchAll(/logEvent\(\s*(?:locked \? )?'([a-z.]+)'(?: : '([a-z.]+)')?/g)].flatMap((match) => [match[1], match[2]]).filter(Boolean);
  assert.ok(events.length > 10);
  for (const lang of ['fr', 'en']) {
    const labels = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', `${lang}.json`), 'utf8')).account.events;
    for (const event of events) assert.ok(labels[event.replace(/\./g, '-')], `${lang}: ${event}`);
  }
});
