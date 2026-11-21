const DAY = 86400000;

export function dayKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function wordsPerMinute(session) {
  return session.activeDuration > 0 ? (session.correctCharacters / 5) / (session.activeDuration / 60) : 0;
}

export function accuracy(session) {
  return session.totalKeystrokes > 0 ? session.correctKeystrokes / session.totalKeystrokes : 1;
}

export function totals(sessions) {
  const duration = sessions.reduce((sum, item) => sum + item.activeDuration, 0);
  const characters = sessions.reduce((sum, item) => sum + item.correctCharacters, 0);
  const keystrokes = sessions.reduce((sum, item) => sum + item.totalKeystrokes, 0);
  const correct = sessions.reduce((sum, item) => sum + item.correctKeystrokes, 0);
  return {
    count: sessions.length,
    duration,
    averageWPM: duration > 0 ? (characters / 5) / (duration / 60) : 0,
    bestWPM: Math.max(0, ...sessions.map(wordsPerMinute)),
    accuracy: keystrokes > 0 ? correct / keystrokes : 1,
  };
}

export function perDay(sessions) {
  const days = new Map();
  for (const session of sessions) {
    const key = dayKey(session.startedAt);
    const day = days.get(key) ?? { day: key, duration: 0, characters: 0 };
    day.duration += session.activeDuration;
    day.characters += session.correctCharacters;
    days.set(key, day);
  }
  return [...days.values()]
    .map((day) => ({ day: day.day, duration: day.duration, wpm: day.duration > 0 ? (day.characters / 5) / (day.duration / 60) : 0 }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function streak(sessions, now = new Date()) {
  const days = new Set(sessions.map((item) => dayKey(item.startedAt)));
  let cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return count;
}
