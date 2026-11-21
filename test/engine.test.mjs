import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { TypingEngine } from '../public/js/core/engine.js';
import { expectedCharacters } from '../public/js/core/typography.js';

const cases = JSON.parse(readFileSync(new URL('./fixtures/typing-cases.json', import.meta.url), 'utf8'));

for (const sample of cases) {
  test(`shared case: ${sample.name}`, () => {
    const engine = new TypingEngine(sample.text, sample.mode);
    for (const input of sample.inputs) {
      for (const character of input) engine.input(character);
    }
    assert.equal(engine.index, sample.index);
    assert.equal(engine.errorCount, sample.errors);
    assert.equal(engine.isComplete, sample.complete);
  });
}

test('a stanza break shows as two lines but is one character', () => {
  const expected = expectedCharacters('a\n\nb', 'strict');
  assert.equal(expected.length, 3);
  assert.equal(expected[1].shown, '\n\n');
});

test('combined characters count as one', () => {
  assert.equal(new TypingEngine('ét', 'strict').expected.length, 2);
});
