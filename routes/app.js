const express = require('express');
const content = require('../tools/content');
const { section } = require('../tools/i18n');

const router = express.Router();

router.get('/library', (req, res) => {
  const kind = content.KINDS.includes(req.query.kind) ? req.query.kind : null;
  const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '';
  const shelf = content.index().books.filter((item) => !kind || item.kind === kind);
  res.render('app/library', {
    kind, query, kinds: content.KINDS,
    books: content.searchBooks(shelf, query),
    texts: query ? content.searchTexts(query) : [],
    counts: Object.fromEntries(content.KINDS.map((name) => [name, content.index().books.filter((item) => item.kind === name).length])),
  });
});

router.get('/book/:id', (req, res, next) => {
  const book = content.book(req.params.id);
  if (!book) return next();
  res.render('app/book', { book });
});

router.get('/type/:id', (req, res, next) => {
  const book = content.book(req.params.id);
  if (!book) return next();
  const chapter = Number.parseInt(req.query.chapter, 10);
  const page = Number.parseInt(req.query.page, 10);
  res.render('app/type', {
    book,
    start: Number.isInteger(chapter) && Number.isInteger(page) ? { chapter, page } : null,
  });
});

const LESSON_ID = /^[a-z-]{2,40}$/;

router.get('/learn', (req, res) => {
  res.render('app/learn', { learnStrings: learnStrings(req.lang, res.locals.t) });
});

router.get('/lesson/:id', (req, res, next) => {
  if (!LESSON_ID.test(req.params.id)) return next();
  res.render('app/lesson', { lessonID: req.params.id, learnStrings: learnStrings(req.lang, res.locals.t) });
});

function learnStrings(lang, t) {
  return {
    lessons: section(lang, 'learn.lessons'), stages: section(lang, 'learn.stages'),
    stageSubtitles: section(lang, 'learn.stageSubtitles'), exercises: section(lang, 'learn.exercises'),
    lessonComplete: t('learn.lessonComplete'), lessonFailed: t('learn.lessonFailed'), failedHint: t('learn.failedHint'),
    retry: t('learn.retry'), nextLesson: t('learn.nextLesson'), back: t('learn.back'), allDone: t('learn.allDone'),
    wpm: t('typing.wpm'), accuracy: t('typing.accuracy'), missed: t('typing.missed'), noMissed: t('typing.noMissed'),
  };
}

router.get('/stories', (req, res) => {
  const stories = content.index().stories;
  res.render('app/stories', {
    sections: ['interactive', 'original'].map((kind) => ({ kind, stories: stories.filter((item) => (item.kind ?? 'interactive') === kind) })),
  });
});

router.get('/story/:id', (req, res, next) => {
  const story = content.story(req.params.id);
  if (!story) return next();
  res.render('app/story', { story });
});

router.get('/read/:id', (req, res, next) => {
  const book = content.book(req.params.id);
  if (!book) return next();
  res.render('app/read', { book });
});

router.get('/settings', (req, res) => {
  res.render('app/settings');
});

router.get('/stats', (req, res) => {
  res.render('app/stats');
});

module.exports = router;
