const express = require('express');
const progress = require('../tools/progress');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!res.locals.currentUser) return res.status(401).json({ error: 'unauthenticated' });
  return next();
});

router.post('/sync', async (req, res) => {
  res.json(await progress.sync(res.locals.currentUser.id, req.body));
});

module.exports = router;
