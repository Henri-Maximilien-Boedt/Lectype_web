import test from 'node:test';
import assert from 'node:assert';
import { positions, next, previous, furthest, ordinal } from '../public/js/core/book.js';
import { makeSession } from '../public/js/core/session-summary.js';
import { TypingMetrics } from '../public/js/core/metrics.js';

const book = { chapters: [
  { number: 1, pages: [{ number: 1 }, { number: 2 }] },
  { number: 2, pages: [{ number: 1 }] },
] };

test('walks through the pages of a book', () => {
  assert.equal(positions(book).length, 3);
  assert.deepEqual(next(book, { chapter: 1, page: 2 }), { chapter: 2, page: 1 });
  assert.equal(next(book, { chapter: 2, page: 1 }), null);
  assert.deepEqual(previous(book, { chapter: 2, page: 1 }), { chapter: 1, page: 2 });
  assert.equal(ordinal(book, { chapter: 2, page: 1 }), 2);
});

test('keeps the furthest bookmark', () => {
  assert.deepEqual(furthest(book, { chapter: 2, page: 1 }, { chapter: 1, page: 1 }), { chapter: 2, page: 1 });
  assert.deepEqual(furthest(book, null, { chapter: 1, page: 2 }), { chapter: 1, page: 2 });
});

test('ignores very short sessions', () => {
  const metrics = new TypingMetrics();
  for (let index = 0; index < 10; index += 1) metrics.record('advanced', index, 'a');
  assert.equal(makeSession({ activity: 'book', itemID: 'x', title: 'X', metrics }), null);
  for (let index = 10; index < 30; index += 1) metrics.record('advanced', index * 0.3, 'a');
  assert.equal(makeSession({ activity: 'book', itemID: 'x', title: 'X', metrics }).correctCharacters, 30);
});
