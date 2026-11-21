const LETTERS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP',
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'];

function qwertyLetters() {
  return Object.fromEntries(LETTERS.map((code) => [code, [code.slice(3).toLowerCase(), code.slice(3)]]));
}

const QWERTY = {
  ...qwertyLetters(),
  Backquote: ['`', '~'], Digit1: ['1', '!'], Digit2: ['2', '@'], Digit3: ['3', '#'], Digit4: ['4', '$'], Digit5: ['5', '%'],
  Digit6: ['6', '^'], Digit7: ['7', '&'], Digit8: ['8', '*'], Digit9: ['9', '('], Digit0: ['0', ')'], Minus: ['-', '_'],
  Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'], Semicolon: [';', ':'],
  Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'],
};

const AZERTY = {
  ...qwertyLetters(),
  KeyQ: ['a', 'A'], KeyW: ['z', 'Z'], KeyA: ['q', 'Q'], KeyZ: ['w', 'W'], Semicolon: ['m', 'M'], KeyM: [',', '?'],
  Backquote: ['²', ''], Digit1: ['&', '1'], Digit2: ['é', '2'], Digit3: ['"', '3'], Digit4: ["'", '4'], Digit5: ['(', '5'],
  Digit6: ['-', '6'], Digit7: ['è', '7'], Digit8: ['_', '8'], Digit9: ['ç', '9'], Digit0: ['à', '0'], Minus: [')', '°'],
  Equal: ['=', '+'], BracketLeft: ['^', '¨'], BracketRight: ['$', '£'], Backslash: ['*', 'µ'], Quote: ['ù', '%'],
  Comma: [';', '.'], Period: [':', '/'], Slash: ['!', '§'], IntlBackslash: ['<', '>'],
};

const QWERTZ = {
  ...qwertyLetters(),
  KeyY: ['z', 'Z'], KeyZ: ['y', 'Y'], Semicolon: ['ö', 'Ö'], Quote: ['ä', 'Ä'], BracketLeft: ['ü', 'Ü'],
  Backquote: ['^', '°'], Digit1: ['1', '!'], Digit2: ['2', '"'], Digit3: ['3', '§'], Digit4: ['4', '$'], Digit5: ['5', '%'],
  Digit6: ['6', '&'], Digit7: ['7', '/'], Digit8: ['8', '('], Digit9: ['9', ')'], Digit0: ['0', '='], Minus: ['ß', '?'],
  Equal: ['´', '`'], BracketRight: ['+', '*'], Backslash: ['#', "'"], Comma: [',', ';'], Period: ['.', ':'], Slash: ['-', '_'],
  IntlBackslash: ['<', '>'],
};

export const PRESETS = { qwerty: QWERTY, azerty: AZERTY, qwertz: QWERTZ };
export const DEAD_KEYS = { azerty: ['BracketLeft'], qwertz: ['Backquote', 'Equal'], qwerty: [] };
const ACCENT_BASES = { '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' }, '¨': { e: 'ë', i: 'ï', u: 'ü' } };

export function guessPreset(baseByCode) {
  if (baseByCode.KeyQ === 'a') return 'azerty';
  if (baseByCode.KeyY === 'z') return 'qwertz';
  return 'qwerty';
}

export function buildLayout(name, liveMap) {
  const preset = PRESETS[name] ?? QWERTY;
  const keys = {};
  for (const [code, [base, shifted]] of Object.entries(preset)) keys[code] = { base, shifted };
  if (liveMap) {
    for (const [code, base] of Object.entries(liveMap)) {
      const known = keys[code];
      keys[code] = { base, shifted: known && known.base === base ? known.shifted : base.toUpperCase() !== base ? base.toUpperCase() : (known?.shifted ?? '') };
    }
  }
  const strokes = new Map();
  for (const [code, { base, shifted }] of Object.entries(keys)) {
    if (base && !strokes.has(base)) strokes.set(base, [{ code, shift: false }]);
  }
  for (const [code, { shifted }] of Object.entries(keys)) {
    if (shifted && !strokes.has(shifted)) strokes.set(shifted, [{ code, shift: true }]);
  }
  for (const deadCode of DEAD_KEYS[name] ?? []) {
    const deadKey = keys[deadCode];
    if (!deadKey) continue;
    for (const [mark, shift] of [[deadKey.base, false], [deadKey.shifted, true]]) {
      for (const [letter, accented] of Object.entries(ACCENT_BASES[mark] ?? {})) {
        const base = strokes.get(letter);
        if (base && !strokes.has(accented)) strokes.set(accented, [{ code: deadCode, shift }, ...base]);
      }
    }
  }
  strokes.set('\n', [{ code: 'Enter', shift: false }]);
  strokes.set(' ', [{ code: 'Space', shift: false }]);
  return { name, keys, strokes, iso: name !== 'qwerty' || Boolean(liveMap?.IntlBackslash) };
}
