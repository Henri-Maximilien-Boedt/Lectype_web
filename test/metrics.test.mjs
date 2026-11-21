import test from 'node:test';
import assert from 'node:assert';
import { TypingMetrics, INACTIVITY_THRESHOLD } from '../public/js/core/metrics.js';

test('computes words per minute and accuracy', () => {
  const metrics = new TypingMetrics();
  for (let index = 0; index < 50; index += 1) metrics.record('advanced', index * 0.2, 'a');
  metrics.record('incorrect', 10, 'b');
  assert.equal(metrics.correctCharacters, 50);
  assert.ok(Math.abs(metrics.accuracy - 50 / 51) < 1e-9);
  assert.ok(Math.abs(metrics.finalWordsPerMinute - 60) < 1e-9);
  assert.deepEqual(metrics.mostMissedCharacters(3), ['b']);
});

test('pauses after five seconds of inactivity', () => {
  const metrics = new TypingMetrics();
  metrics.record('advanced', 0, 'a');
  metrics.record('advanced', 60, 'b');
  assert.equal(metrics.activeDuration, INACTIVITY_THRESHOLD);
  assert.equal(metrics.timeline.samples.length, INACTIVITY_THRESHOLD);
});

test('remembers typed characters and errors over time', () => {
  const metrics = new TypingMetrics();
  metrics.record('advanced', 0, 'a');
  metrics.record('incorrect', 1.5, 'b');
  assert.deepEqual(metrics.typedCharacters, { a: 1 });
  assert.deepEqual(metrics.timeline.errors, [1.5]);
});
