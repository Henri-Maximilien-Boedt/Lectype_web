const db = require('./db');

const TOUCH_INTERVAL_SECONDS = 300;

async function addDevice(userID, sessionID, userAgent) {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO devices (user_id, session_id, user_agent) VALUES (?, ?, ?)',
    args: [userID, sessionID, String(userAgent ?? '').slice(0, 300)],
  });
}

async function findDevice(userID, sessionID) {
  const result = await db.execute({
    sql: 'SELECT id, last_seen_at FROM devices WHERE user_id = ? AND session_id = ?',
    args: [userID, sessionID],
  });
  return result.rows[0] ?? null;
}

async function touchDevice(userID, sessionID) {
  await db.execute({
    sql: `UPDATE devices SET last_seen_at = datetime('now')
          WHERE user_id = ? AND session_id = ? AND last_seen_at < datetime('now', ?)`,
    args: [userID, sessionID, `-${TOUCH_INTERVAL_SECONDS} seconds`],
  });
}

async function listDevices(userID) {
  const result = await db.execute({
    sql: 'SELECT id, session_id, user_agent, created_at, last_seen_at FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC',
    args: [userID],
  });
  return result.rows.map((row) => ({ id: Number(row.id), sessionID: row.session_id, userAgent: row.user_agent, createdAt: row.created_at, lastSeenAt: row.last_seen_at }));
}

function destroyStoredSession(store, sessionID) {
  return new Promise((resolve) => store.destroy(sessionID, () => resolve()));
}

async function removeDevice(store, userID, sessionID) {
  await db.execute({ sql: 'DELETE FROM devices WHERE user_id = ? AND session_id = ?', args: [userID, sessionID] });
  await destroyStoredSession(store, sessionID);
}

async function removeOtherDevices(store, userID, keptSessionID = null) {
  const devices = await listDevices(userID);
  for (const device of devices) {
    if (device.sessionID !== keptSessionID) await removeDevice(store, userID, device.sessionID);
  }
}

async function findDeviceByID(userID, id) {
  const result = await db.execute({ sql: 'SELECT session_id FROM devices WHERE user_id = ? AND id = ?', args: [userID, id] });
  return result.rows[0]?.session_id ?? null;
}

module.exports = { findDeviceByID, addDevice, findDevice, touchDevice, listDevices, removeDevice, removeOtherDevices };
