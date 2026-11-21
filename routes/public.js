const express = require('express');
const { LANGUAGES, section } = require('../tools/i18n');

const LEGAL_UPDATED = '2026-11-21';
const DEFAULT_MAC_DOWNLOAD_URL = 'https://github.com/Henri-Maximilien-Boedt/Lectype_web/releases/latest/download/Lectype.dmg';

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/download', (req, res) => {
  res.render('download', { downloadURL: process.env.MAC_DOWNLOAD_URL || DEFAULT_MAC_DOWNLOAD_URL });
});

router.get('/privacy', (req, res) => {
  res.render('legal/privacy', { sections: section(req.lang, 'legal.privacy'), updated: LEGAL_UPDATED });
});

router.get('/legal', (req, res) => {
  res.render('legal/notice', {
    publisher: process.env.LEGAL_PUBLISHER || null,
    contact: process.env.LEGAL_CONTACT_EMAIL || null,
    host: process.env.LEGAL_HOST || null,
    updated: LEGAL_UPDATED,
  });
});

router.post('/language', (req, res) => {
  const lang = LANGUAGES.includes(req.body.lang) ? req.body.lang : 'fr';
  res.cookie('lang', lang, { maxAge: 365 * 24 * 3600 * 1000, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  const back = req.get('referer');
  res.redirect(back && new URL(back, 'http://local').pathname.startsWith('/') ? new URL(back, 'http://local').pathname : '/');
});

module.exports = router;
