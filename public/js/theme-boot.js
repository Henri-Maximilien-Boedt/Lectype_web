(function () {
  try {
    var stored = JSON.parse(localStorage.getItem('lectype.settings') || '{}');
    if (stored.theme === 'vibrant' || stored.theme === 'paper' || stored.theme === 'minimal') {
      document.documentElement.setAttribute('data-theme', stored.theme);
    }
    if (stored.textSize === 'small' || stored.textSize === 'large') {
      document.documentElement.setAttribute('data-text-size', stored.textSize);
    }
  } catch (error) {}
})();
