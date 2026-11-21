const db = require('./db');

const ITEM_ID = /^[a-z0-9-]{1,80}$/;
const SESSION_ID = /^[0-9a-f-]{36}$/;
const BOOKMARK_KINDS = ['book', 'story', 'reader'];
const ACTIVITIES = ['book', 'story', 'lesson'];
const LAYOUTS = /^[a-z]{2,20}$/;
const MAXIMUM_ITEM_BYTES = 20000;
const MAXIMUM_DETAILS_BYTES = 60000;
const MAXIMUM_SESSIONS_PER_SYNC = 500;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fitsIn(value, bytes) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8') <= bytes;
}

function cleanBookmarks(input) {
  const bookmarks = {};
  if (!isRecord(input)) return bookmarks;
  for (const [key, value] of Object.entries(input).slice(0, 500)) {
    const [kind, itemID] = key.split(':');
    if (!BOOKMARK_KINDS.includes(kind) || !ITEM_ID.test(itemID ?? '') || !isRecord(value) || !fitsIn(value, MAXIMUM_ITEM_BYTES)) continue;
    if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) continue;
    bookmarks[key] = value;
  }
  return bookmarks;
}

function cleanCount(value, maximum) {
  return Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
}

function cleanLearning(input) {
  const learning = {};
  if (!isRecord(input)) return learning;
  for (const [layout, progress] of Object.entries(input).slice(0, 10)) {
    if (!LAYOUTS.test(layout) || !isRecord(progress?.records)) continue;
    const records = {};
    for (const [lessonID, record] of Object.entries(progress.records).slice(0, 60)) {
      if (!ITEM_ID.test(lessonID) || !isRecord(record)) continue;
      const missed = {};
      for (const [character, count] of Object.entries(isRecord(record.missedCharacters) ? record.missedCharacters : {}).slice(0, 120)) {
        if ([...character].length === 1 && cleanCount(count, 1e6) !== null) missed[character] = count;
      }
      records[lessonID] = {
        stars: Math.min(Math.max(Math.trunc(cleanCount(record.stars, 3) ?? 0), 0), 3),
        bestWordsPerMinute: cleanCount(record.bestWordsPerMinute, 1000) ?? 0,
        missedCharacters: missed,
      };
    }
    learning[layout] = { records };
  }
  return learning;
}

function cleanSession(session) {
  if (!isRecord(session) || !SESSION_ID.test(session.id ?? '') || !ACTIVITIES.includes(session.activity)) return null;
  if (!ITEM_ID.test(session.itemID ?? '') || typeof session.title !== 'string' || Number.isNaN(Date.parse(session.startedAt))) return null;
  const numbers = ['activeDuration', 'correctCharacters', 'totalKeystrokes', 'correctKeystrokes'].map((key) => cleanCount(session[key], 1e7));
  if (numbers.includes(null) || !fitsIn(session.details ?? {}, MAXIMUM_DETAILS_BYTES)) return null;
  return {
    id: session.id, activity: session.activity, itemID: session.itemID, title: session.title.slice(0, 200),
    startedAt: new Date(session.startedAt).toISOString(), activeDuration: numbers[0], correctCharacters: numbers[1],
    totalKeystrokes: numbers[2], correctKeystrokes: numbers[3], details: isRecord(session.details) ? session.details : {},
  };
}

function mergeLearning(saved, incoming) {
  const records = { ...(saved?.records ?? {}) };
  for (const [lessonID, record] of Object.entries(incoming?.records ?? {})) {
    const known = records[lessonID];
    if (!known) {
      records[lessonID] = record;
      continue;
    }
    const missed = { ...known.missedCharacters };
    for (const [character, count] of Object.entries(record.missedCharacters)) missed[character] = Math.max(missed[character] ?? 0, count);
    records[lessonID] = {
      stars: Math.max(known.stars, record.stars),
      bestWordsPerMinute: Math.max(known.bestWordsPerMinute, record.bestWordsPerMinute),
      missedCharacters: missed,
    };
  }
  return { records };
}

function newerBookmark(saved, incoming) {
  if (!saved) return incoming;
  return Date.parse(incoming.updatedAt) > Date.parse(saved.updatedAt) ? incoming : saved;
}

async function defaultProfileID(userID) {
  const result = await db.execute({ sql: 'SELECT id FROM profiles WHERE user_id = ? ORDER BY id LIMIT 1', args: [userID] });
  if (result.rows[0]) return Number(result.rows[0].id);
  const created = await db.execute({ sql: 'INSERT INTO profiles (user_id, name) SELECT id, first_name FROM users WHERE id = ? RETURNING id', args: [userID] });
  return Number(created.rows[0].id);
}

async function readItems(profileID) {
  const result = await db.execute({ sql: 'SELECT kind, item_id, data FROM progress WHERE profile_id = ?', args: [profileID] });
  const bookmarks = {};
  const learning = {};
  for (const row of result.rows) {
    const data = JSON.parse(row.data);
    if (row.kind === 'learning') learning[row.item_id] = data;
    else bookmarks[`${row.kind}:${row.item_id}`] = data;
  }
  return { bookmarks, learning };
}

async function writeItem(profileID, kind, itemID, data) {
  await db.execute({
    sql: `INSERT INTO progress (profile_id, kind, item_id, data) VALUES (?, ?, ?, ?)
          ON CONFLICT (profile_id, kind, item_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
    args: [profileID, kind, itemID, JSON.stringify(data)],
  });
}

async function insertSessions(profileID, sessions) {
  for (const session of sessions) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO typing_sessions
            (id, profile_id, activity, item_id, title, started_at, active_duration, correct_characters, total_keystrokes, correct_keystrokes, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [session.id, profileID, session.activity, session.itemID, session.title, session.startedAt, session.activeDuration,
        session.correctCharacters, session.totalKeystrokes, session.correctKeystrokes, JSON.stringify(session.details)],
    });
  }
}

function toSession(row) {
  return {
    id: row.id, activity: row.activity, itemID: row.item_id, title: row.title, startedAt: row.started_at,
    activeDuration: Number(row.active_duration), correctCharacters: Number(row.correct_characters),
    totalKeystrokes: Number(row.total_keystrokes), correctKeystrokes: Number(row.correct_keystrokes), details: JSON.parse(row.details),
  };
}

async function sessionsAfter(profileID, cursor) {
  const result = await db.execute({
    sql: 'SELECT rowid AS position, * FROM typing_sessions WHERE profile_id = ? AND rowid > ? ORDER BY rowid LIMIT 2000',
    args: [profileID, cursor],
  });
  return { sessions: result.rows.map(toSession), cursor: result.rows.length ? Number(result.rows.at(-1).position) : cursor };
}

async function sync(userID, payload) {
  const profileID = await defaultProfileID(userID);
  const saved = await readItems(profileID);
  for (const [key, bookmark] of Object.entries(cleanBookmarks(payload?.bookmarks))) {
    const merged = newerBookmark(saved.bookmarks[key], bookmark);
    if (merged !== saved.bookmarks[key]) {
      const [kind, itemID] = key.split(':');
      await writeItem(profileID, kind, itemID, merged);
      saved.bookmarks[key] = merged;
    }
  }
  for (const [layout, progress] of Object.entries(cleanLearning(payload?.learning))) {
    saved.learning[layout] = mergeLearning(saved.learning[layout], progress);
    await writeItem(profileID, 'learning', layout, saved.learning[layout]);
  }
  const sessions = (Array.isArray(payload?.sessions) ? payload.sessions : []).slice(0, MAXIMUM_SESSIONS_PER_SYNC).map(cleanSession).filter(Boolean);
  await insertSessions(profileID, sessions);
  const cursor = Number.isSafeInteger(payload?.cursor) && payload.cursor >= 0 ? payload.cursor : 0;
  const recent = await sessionsAfter(profileID, cursor);
  return { bookmarks: saved.bookmarks, learning: saved.learning, sessions: recent.sessions, cursor: recent.cursor };
}

async function exportData(userID) {
  const profileID = await defaultProfileID(userID);
  const items = await readItems(profileID);
  const result = await db.execute({ sql: 'SELECT * FROM typing_sessions WHERE profile_id = ? ORDER BY started_at', args: [profileID] });
  return { ...items, sessions: result.rows.map(toSession) };
}

module.exports = { sync, exportData, cleanBookmarks, cleanLearning, cleanSession, mergeLearning };
