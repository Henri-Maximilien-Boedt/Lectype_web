import { read, write } from './storage.js';

const PROGRESS_KEYS = ['bookmarks', 'sessions', 'account', 'syncCursor', 'syncedSessions'];
const userID = document.querySelector('meta[name="lectype-user"]')?.content ?? null;
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ?? '';

function learningKeys() {
  const keys = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('lectype.learning.')) keys.push(key.slice('lectype.'.length));
    }
  } catch (error) {}
  return keys;
}

export function clearLocalProgress() {
  try {
    for (const key of [...PROGRESS_KEYS, ...learningKeys()]) localStorage.removeItem(`lectype.${key}`);
  } catch (error) {}
}

function localLearning() {
  return Object.fromEntries(learningKeys().map((key) => [key.slice('learning.'.length), read(key, { records: {} })]));
}

function mergeSessions(local, incoming) {
  const known = new Set(local.map((session) => session.id));
  const merged = [...local, ...incoming.filter((session) => !known.has(session.id))];
  return merged.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 500);
}

async function sync({ keepalive = false } = {}) {
  const owner = read('account', null);
  if (owner !== null && owner !== userID) clearLocalProgress();
  const syncedIDs = new Set(read('syncedSessions', []));
  const sessions = read('sessions', []);
  const response = await fetch('/api/sync', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive,
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({
      bookmarks: read('bookmarks', {}),
      learning: localLearning(),
      sessions: sessions.filter((session) => !syncedIDs.has(session.id)),
      cursor: read('syncCursor', 0),
    }),
  });
  if (!response.ok) return;
  const merged = await response.json();
  write('bookmarks', merged.bookmarks);
  for (const [layout, progress] of Object.entries(merged.learning)) write(`learning.${layout}`, progress);
  const allSessions = mergeSessions(read('sessions', []), merged.sessions);
  write('sessions', allSessions);
  write('syncedSessions', allSessions.map((session) => session.id));
  write('syncCursor', merged.cursor);
  write('account', userID);
}

for (const form of document.querySelectorAll('form[data-logout]')) {
  form.addEventListener('submit', () => {
    clearLocalProgress();
  });
}

if (document.querySelector('[data-clear-local]')) {
  clearLocalProgress();
}

if (userID) {
  sync().catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync({ keepalive: true }).catch(() => {});
  });
}
