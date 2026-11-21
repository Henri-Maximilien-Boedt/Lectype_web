const crypto = require('crypto');
const db = require('./db');

const LIFETIMES = { verify: 24 * 3600, reset: 3600, 'change-email': 24 * 3600 };

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sqliteDate(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

async function createToken(userID, purpose, { newEmail = null, now = new Date() } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = sqliteDate(new Date(now.getTime() + LIFETIMES[purpose] * 1000));
  await db.execute({
    sql: 'INSERT INTO email_tokens (user_id, purpose, token_hash, new_email, expires_at) VALUES (?, ?, ?, ?, ?)',
    args: [userID, purpose, hashToken(token), newEmail, expiresAt],
  });
  return token;
}

async function findToken(purpose, token, now = new Date()) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const result = await db.execute({
    sql: 'SELECT id, user_id, new_email FROM email_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?',
    args: [hashToken(token), purpose, sqliteDate(now)],
  });
  return result.rows[0] ?? null;
}

async function consumeToken(purpose, token, now = new Date()) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const result = await db.execute({
    sql: `UPDATE email_tokens SET used_at = datetime('now')
          WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
          RETURNING user_id, new_email`,
    args: [hashToken(token), purpose, sqliteDate(now)],
  });
  const row = result.rows[0];
  return row ? { userID: Number(row.user_id), newEmail: row.new_email } : null;
}

async function revokeTokens(userID, purpose) {
  await db.execute({
    sql: "UPDATE email_tokens SET used_at = datetime('now') WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
    args: [userID, purpose],
  });
}

async function recentTokenCount(userID, purpose, seconds = 3600) {
  const result = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM email_tokens WHERE user_id = ? AND purpose = ? AND created_at > datetime('now', ?)",
    args: [userID, purpose, `-${seconds} seconds`],
  });
  return Number(result.rows[0].count);
}

module.exports = { createToken, findToken, consumeToken, revokeTokens, recentTokenCount, hashToken, LIFETIMES };
