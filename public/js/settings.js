import { settings } from './storage.js';

const form = document.getElementById('settings-form');
const current = settings.get();
form.elements.theme.value = current.theme;
form.elements.keyboardLayout.value = current.keyboardLayout;
form.elements.textSize.value = current.textSize;
form.elements.strict.checked = current.strict;
form.elements.showKeyboard.checked = current.showKeyboard;

form.addEventListener('change', () => {
  settings.set({
    theme: form.elements.theme.value,
    keyboardLayout: form.elements.keyboardLayout.value,
    textSize: form.elements.textSize.value,
    strict: form.elements.strict.checked,
    showKeyboard: form.elements.showKeyboard.checked,
  });
  document.documentElement.setAttribute('data-theme', form.elements.theme.value);
  document.getElementById('saved').hidden = false;
});
