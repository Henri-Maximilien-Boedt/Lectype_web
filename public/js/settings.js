import { settings } from './storage.js';

const form = document.getElementById('settings-form');
const current = settings.get();
const root = document.documentElement;
const appearance = ['day', 'evening', 'auto'].includes(current.appearance) ? current.appearance : 'auto';

form.elements.appearance.value = appearance;
form.elements.keyboardLayout.value = current.keyboardLayout;
form.elements.textSize.value = current.textSize;
form.elements.strict.checked = current.strict;
form.elements.showKeyboard.checked = current.showKeyboard;
form.elements.fingerColors.checked = current.fingerColors;

function applyAppearance(value) {
  const evening = value === 'evening' || (value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', evening ? 'evening' : 'day');
}

form.addEventListener('change', () => {
  const values = {
    appearance: form.elements.appearance.value,
    keyboardLayout: form.elements.keyboardLayout.value,
    textSize: form.elements.textSize.value,
    strict: form.elements.strict.checked,
    showKeyboard: form.elements.showKeyboard.checked,
    fingerColors: form.elements.fingerColors.checked,
  };
  settings.set(values);
  applyAppearance(values.appearance);
  if (values.fingerColors) root.setAttribute('data-finger-colors', 'on');
  else root.removeAttribute('data-finger-colors');
  document.getElementById('saved').hidden = false;
});

const languageForm = document.getElementById('language-form');
languageForm.elements.lang.addEventListener('change', () => languageForm.submit());
