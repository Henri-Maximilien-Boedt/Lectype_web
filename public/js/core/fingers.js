const COLUMNS = {
  pinky: ['Backquote', 'Digit1', 'KeyQ', 'KeyA', 'KeyZ', 'IntlBackslash', 'Tab', 'CapsLock', 'ShiftLeft', 'Digit0', 'Minus', 'Equal', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Slash', 'Enter', 'Backspace', 'ShiftRight'],
  ring: ['Digit2', 'KeyW', 'KeyS', 'KeyX', 'Digit9', 'KeyO', 'KeyL', 'Period'],
  middle: ['Digit3', 'KeyE', 'KeyD', 'KeyC', 'Digit8', 'KeyI', 'KeyK', 'Comma'],
  index: ['Digit4', 'Digit5', 'KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV', 'KeyB', 'Digit6', 'Digit7', 'KeyY', 'KeyU', 'KeyH', 'KeyJ', 'KeyN', 'KeyM'],
  thumb: ['Space'],
};

const LEFT = new Set(['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'IntlBackslash', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'Tab', 'CapsLock', 'ShiftLeft']);

export function finger(code) {
  return Object.keys(COLUMNS).find((name) => COLUMNS[name].includes(code)) ?? null;
}

export function isLeftHand(code) {
  return LEFT.has(code);
}
