const express = require('express');
const { LANGUAGES } = require('../tools/i18n');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index');
});

router.post('/language', (req, res) => {
  const lang = LANGUAGES.includes(req.body.lang) ? req.body.lang : 'fr';
  res.cookie('lang', lang, { maxAge: 365 * 24 * 3600 * 1000, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  const back = req.get('referer');
  res.redirect(back && new URL(back, 'http://local').pathname.startsWith('/') ? new URL(back, 'http://local').pathname : '/');
});

module.exports = router;
