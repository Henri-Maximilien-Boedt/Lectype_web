const fs = require('fs');
const path = require('path');

const LANGUAGES = ['fr', 'en'];
const DEFAULT_LANGUAGE = 'fr';
const dictionaries = Object.fromEntries(LANGUAGES.map((language) => [
  language,
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', `${language}.json`), 'utf8')),
]));

function lookup(dictionary, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dictionary);
}

function translate(language, key, values = {}) {
  const template = lookup(dictionaries[language], key) ?? lookup(dictionaries[DEFAULT_LANGUAGE], key) ?? key;
  return String(template).replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
}

function pickLanguage(cookieValue, acceptLanguage) {
  if (LANGUAGES.includes(cookieValue)) return cookieValue;
  const preferred = String(acceptLanguage || '').split(',').map((part) => part.trim().slice(0, 2).toLowerCase());
  return preferred.find((code) => LANGUAGES.includes(code)) || DEFAULT_LANGUAGE;
}

module.exports = { LANGUAGES, DEFAULT_LANGUAGE, translate, pickLanguage, dictionaries };
