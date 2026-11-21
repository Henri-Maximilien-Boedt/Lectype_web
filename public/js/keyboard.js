import { buildLayout, guessPreset } from './core/layouts.js';
import { finger, isLeftHand } from './core/fingers.js';

const ROWS_ISO = [
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Enter'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Backslash'],
  ['ShiftLeft', 'IntlBackslash', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
  ['Space'],
];
const ROWS_ANSI = [
  ROWS_ISO[0],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
  ['Space'],
];
const SYMBOLS = { Backspace: '⌫', Tab: '⇥', CapsLock: '⇪', Enter: '↵', ShiftLeft: '⇧', ShiftRight: '⇧', Space: '' };
const WIDE = { Backspace: 1.6, Tab: 1.5, CapsLock: 1.8, Enter: 1.6, ShiftLeft: 1.3, ShiftRight: 2.4, Space: 6.5 };

export async function loadLayout(preference) {
  if (preference && preference !== 'auto') return buildLayout(preference);
  try {
    if (navigator.keyboard?.getLayoutMap) {
      const map = Object.fromEntries(await navigator.keyboard.getLayoutMap());
      return buildLayout(guessPreset(map), map);
    }
  } catch (error) {}
  const language = (navigator.language || 'en').slice(0, 2);
  return buildLayout(language === 'fr' ? 'azerty' : language === 'de' ? 'qwertz' : 'qwerty');
}

export class OnScreenKeyboard {
  constructor(element, layout) {
    this.element = element;
    this.layout = layout;
    this.keys = new Map();
    this.render();
  }

  render() {
    this.element.replaceChildren();
    const rows = this.layout.iso ? ROWS_ISO : ROWS_ANSI;
    for (const row of rows) {
      const rowElement = document.createElement('div');
      rowElement.className = 'key-row';
      for (const code of row) {
        const key = document.createElement('span');
        key.className = 'key';
        key.style.flexGrow = String(WIDE[code] ?? 1);
        const fingerName = finger(code);
        if (fingerName) key.dataset.finger = fingerName;
        const labels = this.layout.keys[code];
        if (labels) {
          const shown = labels.base.length === 1 && labels.base.toUpperCase() === labels.shifted ? labels.shifted : labels.base;
          key.textContent = shown;
          if (labels.shifted && labels.shifted !== labels.base.toUpperCase()) key.dataset.shifted = labels.shifted;
        } else {
          key.textContent = SYMBOLS[code] ?? '';
          key.classList.add('symbol');
        }
        rowElement.append(key);
        this.keys.set(code, key);
      }
      this.element.append(rowElement);
    }
  }

  highlight(character, { error = false, pendingDeadKey = false } = {}) {
    for (const key of this.keys.values()) key.classList.remove('next', 'error');
    let strokes = character ? this.layout.strokes.get(character) : null;
    if (!strokes && character) strokes = this.layout.strokes.get(character.normalize('NFC'));
    if (!strokes) return;
    if (pendingDeadKey && strokes.length > 1) strokes = strokes.slice(1);
    const state = error ? 'error' : 'next';
    for (const stroke of strokes) {
      this.keys.get(stroke.code)?.classList.add(state);
      if (stroke.shift) this.keys.get(isLeftHand(stroke.code) ? 'ShiftRight' : 'ShiftLeft')?.classList.add(state);
    }
  }
}
