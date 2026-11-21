const { translate, pickLanguage } = require('../tools/i18n');

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function language(req, res, next) {
  const lang = pickLanguage(readCookie(req, 'lang'), req.headers['accept-language']);
  req.lang = lang;
  res.locals.lang = lang;
  res.locals.t = (key, values) => translate(lang, key, values);
  next();
}

module.exports = language;
