const PREFIX = 'lectype.';
const MAX_SESSIONS = 500;

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {}
}

export const settings = {
  get() {
    return { appearance: 'auto', keyboardLayout: 'auto', strict: false, showKeyboard: true, fingerColors: false, textSize: 'normal', ...read('settings', {}) };
  },
  set(changes) {
    write('settings', { ...settings.get(), ...changes });
  },
};

export const bookmarks = {
  get(kind, id) {
    return read('bookmarks', {})[`${kind}:${id}`] ?? null;
  },
  set(kind, id, value) {
    const all = read('bookmarks', {});
    all[`${kind}:${id}`] = { ...value, updatedAt: new Date().toISOString() };
    write('bookmarks', all);
  },
  all() {
    return read('bookmarks', {});
  },
};

export const sessions = {
  all() {
    return read('sessions', []);
  },
  record(session) {
    const all = sessions.all();
    all.unshift(session);
    write('sessions', all.slice(0, MAX_SESSIONS));
  },
};

export function currentBook() {
  let latest = null;
  for (const [key, value] of Object.entries(bookmarks.all())) {
    if (!key.startsWith('book:')) continue;
    if (!latest || value.updatedAt > latest.updatedAt) latest = { id: key.slice(5), ...value };
  }
  return latest;
}
