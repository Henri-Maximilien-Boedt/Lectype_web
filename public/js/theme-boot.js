(function () {
  try {
    var theme = localStorage.getItem('lectype.theme');
    if (theme === 'vibrant' || theme === 'paper' || theme === 'minimal') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (error) {}
})();
