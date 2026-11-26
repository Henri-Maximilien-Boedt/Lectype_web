(function () {
  var root = document.documentElement;
  var stored = {};
  try {
    stored = JSON.parse(localStorage.getItem('lectype.settings') || '{}');
  } catch (error) {}
  var preference = stored.appearance === 'day' || stored.appearance === 'evening' ? stored.appearance : 'auto';
  var query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function apply() {
    var evening = preference === 'evening' || (preference === 'auto' && query && query.matches);
    root.setAttribute('data-theme', evening ? 'evening' : 'day');
  }
  apply();
  if (query && query.addEventListener) query.addEventListener('change', apply);
  if (stored.textSize === 'small' || stored.textSize === 'large') root.setAttribute('data-text-size', stored.textSize);
  if (stored.fingerColors) root.setAttribute('data-finger-colors', 'on');
})();
