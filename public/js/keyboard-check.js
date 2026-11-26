const KEY = 'lectype.keyboardForced';

function force() {
  document.documentElement.setAttribute('data-keyboard', 'on');
}

try {
  if (sessionStorage.getItem(KEY) === 'on') force();
} catch (error) {}

for (const button of document.querySelectorAll('[data-force-keyboard]')) {
  button.addEventListener('click', () => {
    try { sessionStorage.setItem(KEY, 'on'); } catch (error) {}
    force();
    document.getElementById('typing-input')?.focus();
  });
}
