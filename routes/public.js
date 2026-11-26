const express = require('express');
const { LANGUAGES, section } = require('../tools/i18n');
const content = require('../tools/content');

const LEGAL_UPDATED = '2026-11-21';
const DEFAULT_MAC_DOWNLOAD_URL = 'https://github.com/Henri-Maximilien-Boedt/Lectype_web/releases/latest/download/Lectype.dmg';

const router = express.Router();

const SHELF = ['alice-adventures-in-wonderland', 'le-tour-du-monde-en-80-jours', 'household-tales', 'just-so-stories', 'poe-short-fiction', 'wilde-childrens-stories'];
const SAMPLE_BOOK = 'contes-perrault';

function homeData() {
  const index = content.index();
  const sample = content.book(SAMPLE_BOOK);
  return {
    totals: {
      books: index.books.length,
      pages: index.books.reduce((sum, book) => sum + book.pageCount, 0),
      stories: index.stories.length,
    },
    shelf: SHELF.map((id) => index.books.find((book) => book.id === id)).filter(Boolean),
    sample: sample && {
      author: sample.author,
      title: sample.chapters[0].title,
      pageCount: sample.chapters[0].pages.length,
      text: sample.chapters[0].pages[0].text.split('\n')[0],
    },
  };
}

router.get('/', (req, res) => {
  res.render('index', homeData());
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
