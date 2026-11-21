require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const compression = require('compression');

const db = require('./tools/db');
const { purgeOldEvents } = require('./tools/security-log');
const securityHeaders = require('./middlewares/security-headers');
const canonicalHost = require('./middlewares/canonical-host');
const language = require('./middlewares/language');
const csrf = require('./middlewares/csrf');
const currentUser = require('./middlewares/current-user');
const { createRateLimits } = require('./middlewares/rate-limits');
const { createAuthRoutes } = require('./routes/auth');
const publicRoutes = require('./routes/public');
const appRoutes = require('./routes/app');
const apiRoutes = require('./routes/api');
const { createAccountRoutes } = require('./routes/account');

const isProduction = process.env.NODE_ENV === 'production';

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (isProduction) throw new Error('SESSION_SECRET doit être défini en production.');
  return crypto.randomBytes(32).toString('hex');
}

function createApp({ sessionStore, authDelayMs, rateLimits } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  if (isProduction) app.use(canonicalHost(process.env.CANONICAL_HOST));
  app.use(securityHeaders);
  app.use(compression());
  app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: isProduction ? '1h' : 0 }));
  app.use('/content', express.static(path.join(__dirname, 'content'), { index: false, maxAge: isProduction ? '1d' : 0 }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(session({
    name: 'lectype.sid',
    secret: sessionSecret(),
    store: sessionStore ?? new SQLiteStore({ db: 'sessions.db', dir: db.DATA_DIR }),
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax' },
  }));
  app.use(language);
  app.use(currentUser);
  app.use(csrf);

  app.use(publicRoutes);
  const limits = createRateLimits(rateLimits);
  app.use(createAuthRoutes(limits, { delayStepMs: authDelayMs }));
  app.use('/app', appRoutes);
  app.use('/api', apiRoutes);
  app.use('/account', createAccountRoutes(limits));

  app.use((req, res) => res.status(404).render('error', { status: 404, messageKey: 'errors.notFound' }));
  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).render('error', { status: 500, messageKey: 'errors.server' });
  });
  return app;
}

const REQUIRED_IN_PRODUCTION = ['SESSION_SECRET', 'BASE_URL', 'CANONICAL_HOST', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL'];

function checkProductionSettings() {
  if (!isProduction) return;
  const missing = REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Variables manquantes en production : ${missing.join(', ')}`);
}

async function start() {
  checkProductionSettings();
  await db.ensureSchema();
  await purgeOldEvents();
  setInterval(() => purgeOldEvents().catch((error) => console.error(error)), 24 * 3600 * 1000).unref();
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  const announce = () => console.log(`Lectype web sur le port ${port}`);
  if (process.env.IP) app.listen(port, process.env.IP, announce);
  else app.listen(port, announce);
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createApp };
