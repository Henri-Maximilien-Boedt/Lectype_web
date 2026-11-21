const db = require('./db');

async function logEvent(event, { userID = null, ip = '' } = {}) {
  try {
    await db.execute({ sql: 'INSERT INTO security_events (user_id, event, ip) VALUES (?, ?, ?)', args: [userID, event, String(ip).slice(0, 64)] });
  } catch (error) {
    console.error('Journal de sécurité indisponible :', error.message);
  }
}

async function eventsFor(userID, limit = 50) {
  const result = await db.execute({
    sql: 'SELECT event, ip, created_at FROM security_events WHERE user_id = ? ORDER BY id DESC LIMIT ?',
    args: [userID, limit],
  });
  return result.rows.map((row) => ({ event: row.event, ip: row.ip, createdAt: row.created_at }));
}

const RETENTION_DAYS = 180;

async function purgeOldEvents(days = RETENTION_DAYS) {
  await db.execute({ sql: "DELETE FROM security_events WHERE created_at < datetime('now', ?)", args: [`-${days} days`] });
}

module.exports = { logEvent, eventsFor, purgeOldEvents, RETENTION_DAYS };
