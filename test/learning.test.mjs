import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout } from '../public/js/core/layouts.js';
import { lessonsFor, exercisesFor, starsFor, nextLesson, isUnlocked, recordResult, reviewLesson, wordsUsing } from '../public/js/core/learning.js';

const azerty = buildLayout('azerty');
const qwerty = buildLayout('qwerty');

test('lessons follow physical keys on every layout', () => {
  assert.deepEqual(lessonsFor(azerty, 'fr')[0].newCharacters, ['f', 'j']);
  assert.deepEqual(lessonsFor(azerty, 'fr')[3].newCharacters, ['q', 'm']);
  assert.deepEqual(lessonsFor(qwerty, 'en')[3].newCharacters, ['a', ';']);
});

test('azerty french path ends with accents, dead keys and numbers', () => {
  const lessons = lessonsFor(azerty, 'fr');
  const byID = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson]));
  assert.ok(byID['accents-direct'].newCharacters.includes('é'));
  assert.ok(byID['accents-composed'].newCharacters.includes('ê'));
  assert.equal(lessons.at(-1).id, 'numbers');
  assert.ok(byID.capitals.newCharacters.includes('A'));
});

test('a letter is taught only once', () => {
  const all = lessonsFor(azerty, 'fr').flatMap((lesson) => lesson.newCharacters);
  assert.equal(new Set(all).size, all.length);
});

test('exercises are reproducible and only use known characters', () => {
  const lesson = lessonsFor(azerty, 'fr')[1];
  const words = ['dk', 'fjd', 'kj', 'jd', 'fd', 'dkf', 'maison'];
  const first = exercisesFor(lesson, words, 42);
  assert.deepEqual(first, exercisesFor(lesson, words, 42));
  assert.equal(first[0].text, 'ddd ddd ddd ddd');
  const allowed = new Set([...lesson.knownCharacters, ' ']);
  for (const exercise of first) assert.ok([...exercise.text].every((character) => allowed.has(character)), exercise.text);
  assert.ok(first.some((exercise) => exercise.kind === 'words'));
  assert.ok(!first.some((exercise) => exercise.text.includes('maison')));
});

test('words containing the new letters come first', () => {
  assert.deepEqual(wordsUsing(['as', 'la', 'sa', 'xx'], new Set(['a', 's', 'l']), new Set(['l'])), ['la', 'as', 'sa']);
});

test('stars follow accuracy thresholds', () => {
  assert.equal(starsFor(0.89), 0);
  assert.equal(starsFor(0.9), 1);
  assert.equal(starsFor(0.97), 2);
  assert.equal(starsFor(0.99), 3);
});

test('a star unlocks the next lesson and weak keys build a review', () => {
  const lessons = lessonsFor(azerty, 'fr');
  let progress = { records: {} };
  assert.equal(nextLesson(progress, lessons).id, 'home-index');
  assert.equal(isUnlocked(progress, lessons, lessons[1]), false);
  progress = recordResult(progress, 'home-index', { accuracy: 0.92, wordsPerMinute: 20, missedCharacters: { j: 4, f: 1 } });
  assert.equal(isUnlocked(progress, lessons, lessons[1]), true);
  assert.equal(nextLesson(progress, lessons).id, 'home-middle');
  assert.deepEqual(reviewLesson(progress, lessons).newCharacters, ['j', 'f']);
  progress = recordResult(progress, 'home-index', { accuracy: 0.85, wordsPerMinute: 10, missedCharacters: {} });
  assert.equal(progress.records['home-index'].stars, 1);
});
