import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totals, perDay, streak, wordsPerMinute } from '../public/js/core/statistics.js';

function session(startedAt, activeDuration, correctCharacters, totalKeystrokes = correctCharacters, correctKeystrokes = correctCharacters) {
  return { startedAt, activeDuration, correctCharacters, totalKeystrokes, correctKeystrokes };
}

test('words per minute counts five characters per word', () => {
  assert.equal(wordsPerMinute(session('2026-11-20T10:00:00', 60, 200)), 40);
});

test('totals weight speed by time and keep the best session', () => {
  const result = totals([session('2026-11-20T10:00:00', 60, 200), session('2026-11-20T11:00:00', 120, 200, 110, 100)]);
  assert.equal(result.count, 2);
  assert.equal(result.duration, 180);
  assert.equal(Math.round(result.averageWPM), 27);
  assert.equal(result.bestWPM, 40);
  assert.equal(Math.round(result.accuracy * 1000), 968);
});

test('totals of nothing are zero with full accuracy', () => {
  assert.deepEqual(totals([]), { count: 0, duration: 0, averageWPM: 0, bestWPM: 0, accuracy: 1 });
});

test('per day groups sessions by local day in order', () => {
  const days = perDay([session('2026-11-21T09:00:00', 60, 100), session('2026-11-20T09:00:00', 60, 200), session('2026-11-21T10:00:00', 60, 300)]);
  assert.deepEqual(days.map((day) => day.day), ['2026-11-20', '2026-11-21']);
  assert.equal(days[1].wpm, 40);
});

test('streak counts consecutive days ending today or yesterday', () => {
  const sessions = [session('2026-11-21T09:00:00', 60, 100), session('2026-11-20T09:00:00', 60, 100), session('2026-11-18T09:00:00', 60, 100)];
  assert.equal(streak(sessions, new Date('2026-11-21T20:00:00')), 2);
  assert.equal(streak(sessions, new Date('2026-11-22T20:00:00')), 2);
  assert.equal(streak(sessions, new Date('2026-11-23T20:00:00')), 0);
});

test('minutes typed today and the last days include empty days', async () => {
  const { minutesOn, lastDays } = await import('../public/js/core/statistics.js');
  const sessions = [session('2026-11-21T09:00:00', 240, 100), session('2026-11-21T18:00:00', 120, 100), session('2026-11-19T09:00:00', 60, 200)];
  assert.equal(minutesOn(sessions, new Date('2026-11-21T20:00:00')), 6);
  const days = lastDays(sessions, 3, new Date('2026-11-21T20:00:00'));
  assert.deepEqual(days.map((day) => day.day), ['2026-11-19', '2026-11-20', '2026-11-21']);
  assert.equal(days[0].wpm, 40);
  assert.equal(days[1].wpm, 0);
});
