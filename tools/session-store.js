const session = require('express-session');
const db = require('./db');

const DEFAULT_LIFETIME_MS = 24 * 3600 * 1000;
const CLEANUP_INTERVAL_MS = 3600 * 1000;

function expiryOf(data, now) {
  const expires = data?.cookie?.expires ? new Date(data.cookie.expires).getTime() : NaN;
  return Number.isFinite(expires) ? expires : now + DEFAULT_LIFETIME_MS;
}

function callback(promise, done) {
  promise.then((value) => done?.(null, value), (error) => done?.(error));
}

class LibsqlSessionStore extends session.Store {
  constructor({ client = db, now = () => Date.now() } = {}) {
    super();
    this.client = client;
    this.now = now;
  }

  get(sid, done) {
    callback((async () => {
      const result = await this.client.execute({ sql: 'SELECT data, expires_at FROM sessions WHERE sid = ?', args: [sid] });
      const row = result.rows[0];
      if (!row) return null;
      if (Number(row.expires_at) <= this.now()) {
        await this.client.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] });
        return null;
      }
      return JSON.parse(row.data);
    })(), done);
  }

  set(sid, data, done) {
    callback(this.client.execute({
      sql: `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
            ON CONFLICT (sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`,
      args: [sid, JSON.stringify(data), expiryOf(data, this.now())],
    }).then(() => undefined), done);
  }

  touch(sid, data, done) {
    callback(this.client.execute({
      sql: 'UPDATE sessions SET expires_at = ? WHERE sid = ?',
      args: [expiryOf(data, this.now()), sid],
    }).then(() => undefined), done);
  }

  destroy(sid, done) {
    callback(this.client.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] }).then(() => undefined), done);
  }

  async removeExpired() {
    await this.client.execute({ sql: 'DELETE FROM sessions WHERE expires_at <= ?', args: [this.now()] });
  }

  startCleanup() {
    setInterval(() => this.removeExpired().catch((error) => console.error(error)), CLEANUP_INTERVAL_MS).unref();
  }
}

module.exports = { LibsqlSessionStore, DEFAULT_LIFETIME_MS };
