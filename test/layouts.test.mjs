import test from 'node:test';
import assert from 'node:assert';
import { buildLayout, guessPreset } from '../public/js/core/layouts.js';

test('finds the keys of a character on each preset', () => {
  const azerty = buildLayout('azerty');
  assert.deepEqual(azerty.strokes.get('a'), [{ code: 'KeyQ', shift: false }]);
  assert.deepEqual(azerty.strokes.get('1'), [{ code: 'Digit1', shift: true }]);
  assert.deepEqual(azerty.strokes.get('é'), [{ code: 'Digit2', shift: false }]);
  assert.deepEqual(azerty.strokes.get('ê'), [{ code: 'BracketLeft', shift: false }, { code: 'KeyE', shift: false }]);
  assert.deepEqual(buildLayout('qwerty').strokes.get('A'), [{ code: 'KeyA', shift: true }]);
  assert.deepEqual(buildLayout('qwertz').strokes.get('z'), [{ code: 'KeyY', shift: false }]);
});

test('guesses the preset from a live layout map', () => {
  assert.equal(guessPreset({ KeyQ: 'a' }), 'azerty');
  assert.equal(guessPreset({ KeyQ: 'q', KeyY: 'z' }), 'qwertz');
  assert.equal(guessPreset({ KeyQ: 'q', KeyY: 'y' }), 'qwerty');
});

test('a live layout map overrides the preset', () => {
  const layout = buildLayout('azerty', { KeyQ: 'a', Digit2: 'é', IntlBackslash: '<' });
  assert.deepEqual(layout.strokes.get('é'), [{ code: 'Digit2', shift: false }]);
  assert.equal(layout.iso, true);
});
