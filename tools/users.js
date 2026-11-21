const db = require('./db');

const LOCK_THRESHOLD = 10;
const LOCK_MINUTES = 15;

function toUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id), email: row.email, firstName: row.first_name, passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at, failedLogins: Number(row.failed_logins), lockedUntil: row.locked_until,
    createdAt: row.created_at,
  };
}

async function findByEmail(email) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return toUser(result.rows[0]);
}

async function findByID(id) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return toUser(result.rows[0]);
}

async function createUser({ email, passwordHash, firstName }) {
  const result = await db.execute({
    sql: 'INSERT INTO users (email, password_hash, first_name) VALUES (?, ?, ?) RETURNING id',
    args: [email, passwordHash, firstName],
  });
  return Number(result.rows[0].id);
}

async function markVerified(id) {
  await db.execute({
    sql: "UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')), updated_at = datetime('now') WHERE id = ?",
    args: [id],
  });
  const profiles = await db.execute({ sql: 'SELECT COUNT(*) AS count FROM profiles WHERE user_id = ?', args: [id] });
  if (Number(profiles.rows[0].count) === 0) {
    await db.execute({ sql: 'INSERT INTO profiles (user_id, name) SELECT id, first_name FROM users WHERE id = ?', args: [id] });
  }
}

async function updatePassword(id, passwordHash) {
  await db.execute({
    sql: "UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?",
    args: [passwordHash, id],
  });
}

function isLocked(user, now = new Date()) {
  return Boolean(user.lockedUntil) && new Date(`${user.lockedUntil.replace(' ', 'T')}Z`) > now;
}

async function recordFailedLogin(id) {
  const result = await db.execute({
    sql: `UPDATE users SET failed_logins = failed_logins + 1,
          locked_until = CASE WHEN failed_logins + 1 >= ? THEN datetime('now', ?) ELSE locked_until END
          WHERE id = ? RETURNING failed_logins`,
    args: [LOCK_THRESHOLD, `+${LOCK_MINUTES} minutes`, id],
  });
  return Number(result.rows[0]?.failed_logins ?? 0);
}

async function resetFailedLogins(id) {
  await db.execute({ sql: 'UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', args: [id] });
}

async function updateFirstName(id, firstName) {
  await db.execute({ sql: "UPDATE users SET first_name = ?, updated_at = datetime('now') WHERE id = ?", args: [firstName, id] });
}

async function updateEmail(id, email) {
  await db.execute({ sql: "UPDATE users SET email = ?, email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", args: [email, id] });
}

async function deleteUser(id) {
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
}

module.exports = { updateFirstName, updateEmail, deleteUser, findByEmail, findByID, createUser, markVerified, updatePassword, isLocked, recordFailedLogin, resetFailedLogins, LOCK_THRESHOLD };
