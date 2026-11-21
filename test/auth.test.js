const test = require('node:test');
const assert = require('node:assert');
const { startTestServer, Browser, lastEmailTo, withoutTokens } = require('./helpers/server');
const db = require('../tools/db');
const { passwordProblem } = require('../tools/passwords');
const { hashToken } = require('../tools/tokens');

const PASSWORD = 'trois chats sur la lune';
let server;
let counter = 0;

test.before(async () => { server = await startTestServer(); });
test.after(async () => { await server.close(); });

function newEmail() {
  counter += 1;
  return `eleve${counter}@exemple.fr`;
}

function tokenIn(message) {
  return message.text.match(/token=([A-Za-z0-9_-]+)/)[1];
}

async function signUp(browser, email, password = PASSWORD) {
  return browser.post('/signup', { firstName: 'Léa', email, password, confirm: password }, '/signup');
}

async function verifiedAccount() {
  const email = newEmail();
  const browser = new Browser(server.base);
  await signUp(browser, email);
  await browser.request(`/verify?token=${tokenIn(lastEmailTo(email))}`);
  return { email, browser };
}

test('weak passwords are refused', () => {
  assert.equal(passwordProblem('court'), 'tooShort');
  assert.equal(passwordProblem('motdepasse123'), 'tooCommon');
  assert.equal(passwordProblem('aaaaaaaaaaaaaaa'), 'tooCommon');
  assert.equal(passwordProblem('x'.repeat(80) + 'é'), 'tooLong');
  assert.equal(passwordProblem('lea.martin-2026!', { email: 'lea.martin@exemple.fr' }), 'personal');
  assert.equal(passwordProblem(PASSWORD), null);
});

test('sign up stores a bcrypt hash and only the hash of the token', async () => {
  const email = newEmail();
  const response = await signUp(new Browser(server.base), email);
  assert.equal(response.status, 200);
  const user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows[0];
  assert.match(user.password_hash, /^\$2[aby]\$12\$/);
  assert.equal(user.email_verified_at, null);
  const token = tokenIn(lastEmailTo(email));
  const stored = (await db.execute({ sql: 'SELECT token_hash FROM email_tokens WHERE user_id = ?', args: [user.id] })).rows[0];
  assert.equal(stored.token_hash, hashToken(token));
  assert.notEqual(stored.token_hash, token);
});

test('signing up with an existing address gives the same answer and warns the owner', async () => {
  const { email } = await verifiedAccount();
  const fresh = await signUp(new Browser(server.base), newEmail());
  const again = await signUp(new Browser(server.base), email);
  assert.equal(again.status, fresh.status);
  assert.equal(withoutTokens(again.text.replace(email, '')), withoutTokens(fresh.text.replace(/eleve\d+@exemple\.fr/, '')));
  assert.match(lastEmailTo(email).subject, /Tentative|attempt/);
});

test('an unverified account cannot log in and a verification link works only once', async () => {
  const email = newEmail();
  const browser = new Browser(server.base);
  await signUp(browser, email);
  const refused = await browser.post('/login', { email, password: PASSWORD });
  assert.equal(refused.status, 403);
  const token = tokenIn(lastEmailTo(email));
  assert.equal((await browser.request(`/verify?token=${token}`)).status, 200);
  assert.equal((await browser.request(`/verify?token=${token}`)).status, 400);
  const accepted = await browser.post('/login', { email, password: PASSWORD });
  assert.equal(accepted.status, 303);
});

test('verification links expire after 24 hours', async () => {
  const email = newEmail();
  await signUp(new Browser(server.base), email);
  const token = tokenIn(lastEmailTo(email));
  await db.execute({ sql: "UPDATE email_tokens SET expires_at = datetime('now', '-1 minute') WHERE token_hash = ?", args: [hashToken(token)] });
  assert.equal((await new Browser(server.base).request(`/verify?token=${token}`)).status, 400);
});

test('login errors are identical for an unknown address and a wrong password', async () => {
  const { email } = await verifiedAccount();
  const wrong = await new Browser(server.base).post('/login', { email, password: 'pas le bon mot de passe' });
  const unknown = await new Browser(server.base).post('/login', { email: 'personne@exemple.fr', password: 'pas le bon mot de passe' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(withoutTokens(wrong.text.replace(email, '')), withoutTokens(unknown.text.replace('personne@exemple.fr', '')));
});

test('the session is regenerated at login and the cookie is protected', async () => {
  const { email, browser } = await verifiedAccount();
  await browser.request('/login');
  const before = browser.sessionID;
  const response = await browser.post('/login', { email, password: PASSWORD, remember: 'on' });
  assert.notEqual(browser.sessionID, before);
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('lectype.sid='));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Expires=/);
  const page = await browser.request('/app/library');
  assert.match(page.text, /Léa/);
});

test('without remember me the cookie ends with the browser', async () => {
  const { email, browser } = await verifiedAccount();
  const response = await browser.post('/login', { email, password: PASSWORD });
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('lectype.sid='));
  assert.doesNotMatch(cookie, /Expires=/);
});

test('logging out removes the device and the session', async () => {
  const { email, browser } = await verifiedAccount();
  await browser.post('/login', { email, password: PASSWORD });
  const user = (await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })).rows[0];
  assert.equal((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM devices WHERE user_id = ?', args: [user.id] })).rows[0].n, 1);
  await browser.post('/logout', {}, '/app/library');
  assert.equal((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM devices WHERE user_id = ?', args: [user.id] })).rows[0].n, 0);
  assert.doesNotMatch((await browser.request('/app/library')).text, /Léa/);
});

test('an account locks after ten failures, even with the right password', async () => {
  const { email } = await verifiedAccount();
  await db.execute({ sql: 'UPDATE users SET failed_logins = 9 WHERE email = ?', args: [email] });
  await new Browser(server.base).post('/login', { email, password: 'encore une erreur ici' });
  const locked = await new Browser(server.base).post('/login', { email, password: PASSWORD });
  assert.equal(locked.status, 401);
});

test('password reset: same answer for unknown addresses, one hour link, single use, sessions closed', async () => {
  const { email } = await verifiedAccount();
  const other = new Browser(server.base);
  await other.post('/login', { email, password: PASSWORD });
  const known = await new Browser(server.base).post('/forgot', { email }, '/forgot');
  const unknown = await new Browser(server.base).post('/forgot', { email: 'personne@exemple.fr' }, '/forgot');
  assert.equal(withoutTokens(known.text.replace(email, '')), withoutTokens(unknown.text.replace('personne@exemple.fr', '')));
  const token = tokenIn(lastEmailTo(email));
  const row = (await db.execute({ sql: "SELECT (julianday(expires_at) - julianday('now')) * 24 AS hours FROM email_tokens WHERE token_hash = ?", args: [hashToken(token)] })).rows[0];
  assert.ok(row.hours > 0.9 && row.hours <= 1);
  const browser = new Browser(server.base);
  const weak = await browser.post('/reset', { token, password: 'court', confirm: 'court' }, `/reset?token=${token}`);
  assert.equal(weak.status, 400);
  const newPassword = 'un nouveau mot de passe solide';
  const done = await browser.post('/reset', { token, password: newPassword, confirm: newPassword }, `/reset?token=${token}`);
  assert.equal(done.status, 200);
  assert.equal((await browser.request(`/reset?token=${token}`)).status, 400);
  assert.doesNotMatch((await other.request('/app/library')).text, /Léa/);
  assert.equal((await new Browser(server.base).post('/login', { email, password: PASSWORD })).status, 401);
  assert.equal((await new Browser(server.base).post('/login', { email, password: newPassword })).status, 303);
});

test('forms without a CSRF token are refused', async () => {
  const response = await new Browser(server.base).request('/login', { method: 'POST', form: { email: 'a@b.fr', password: PASSWORD } });
  assert.equal(response.status, 403);
});

test('the login form is rate limited per IP address', async () => {
  const limited = await startTestServer({ realLimits: true });
  try {
    const browser = new Browser(limited.base);
    let last;
    for (let attempt = 0; attempt < 11; attempt += 1) last = await browser.post('/login', { email: 'x@exemple.fr', password: 'nimporte quoi du tout' });
    assert.equal(last.status, 429);
  } finally {
    await limited.close();
  }
});

test('login and sign up share one page with two tabs', async () => {
  const browser = new Browser(server.base);
  const login = await browser.request('/login');
  const signup = await browser.request('/signup');
  for (const page of [login, signup]) {
    assert.match(page.text, /href="\/login"/);
    assert.match(page.text, /href="\/signup"/);
  }
  assert.match(login.text, /<a href="\/login" aria-current="page">/);
  assert.match(signup.text, /<a href="\/signup" aria-current="page">/);
  assert.match(signup.text, /name="firstName"/);
  assert.doesNotMatch(login.text, /name="firstName"/);
});
