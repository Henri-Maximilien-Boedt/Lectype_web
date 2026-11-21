const express = require('express');
const users = require('../tools/users');
const tokens = require('../tools/tokens');
const devices = require('../tools/devices');
const mailer = require('../tools/mailer');
const emails = require('../tools/emails');
const { logEvent } = require('../tools/security-log');
const { passwordProblem, hashPassword, verifyPassword } = require('../tools/passwords');
const { normalizeEmail, normalizeFirstName, text } = require('../tools/validation');
const { regenerate } = require('../middlewares/current-user');

const REMEMBER_MS = 30 * 24 * 3600 * 1000;
const MAXIMUM_EMAILS_PER_HOUR = 3;
const MAXIMUM_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
}

function notice(res, key, { status = 200, link = null, values = {} } = {}) {
  res.status(status).render('auth/notice', { key, link, values });
}

function createAuthRoutes(limits, { delayStepMs = 400 } = {}) {
  const router = express.Router();

  router.get('/signup', (req, res) => {
    if (res.locals.currentUser) return res.redirect('/app/library');
    res.render('auth/signup', { values: {}, problems: {} });
  });

  router.post('/signup', limits.signup, async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const firstName = normalizeFirstName(req.body.firstName);
    const password = text(req.body.password, 500);
    const problems = {};
    if (!firstName) problems.firstName = 'auth.problems.firstName';
    if (!email) problems.email = 'auth.problems.email';
    const weakness = passwordProblem(password, { email: email ?? '', firstName: firstName ?? '' });
    if (weakness) problems.password = `auth.problems.password.${weakness}`;
    else if (password !== text(req.body.confirm, 500)) problems.confirm = 'auth.problems.confirm';
    if (Object.keys(problems).length) {
      return res.status(400).render('auth/signup', { values: { email: text(req.body.email), firstName: text(req.body.firstName) }, problems });
    }
    const passwordHash = await hashPassword(password);
    const existing = await users.findByEmail(email);
    if (!existing) {
      try {
        const userID = await users.createUser({ email, passwordHash, firstName });
        mailer.send(emails.verify(req.lang, email, firstName, await tokens.createToken(userID, 'verify')));
        await logEvent('signup', { userID, ip: req.ip });
      } catch (error) {
        if (!String(error.message).includes('UNIQUE')) throw error;
      }
    } else if (!existing.emailVerifiedAt) {
      if (await tokens.recentTokenCount(existing.id, 'verify') < MAXIMUM_EMAILS_PER_HOUR) {
        mailer.send(emails.verify(req.lang, email, existing.firstName, await tokens.createToken(existing.id, 'verify')));
      }
    } else {
      mailer.send(emails.accountExists(req.lang, email));
      await logEvent('signup.existing', { userID: existing.id, ip: req.ip });
    }
    notice(res, 'checkEmail', { values: { email } });
  });

  router.get('/verify', async (req, res) => {
    const consumed = await tokens.consumeToken('verify', req.query.token);
    if (!consumed) return notice(res, 'linkInvalid', { status: 400 });
    await users.markVerified(consumed.userID);
    await logEvent('email.verified', { userID: consumed.userID, ip: req.ip });
    notice(res, 'verified', { link: { href: '/login', key: 'nav.login' } });
  });

  router.post('/verify/resend', limits.emails, async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const user = email ? await users.findByEmail(email) : null;
    if (user && !user.emailVerifiedAt && await tokens.recentTokenCount(user.id, 'verify') < MAXIMUM_EMAILS_PER_HOUR) {
      mailer.send(emails.verify(req.lang, user.email, user.firstName, await tokens.createToken(user.id, 'verify')));
    }
    notice(res, 'checkEmail', { values: { email: email ?? '' } });
  });

  router.get('/login', (req, res) => {
    if (res.locals.currentUser) return res.redirect('/app/library');
    res.render('auth/login', { values: {}, problem: null });
  });

  router.post('/login', limits.login, async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = text(req.body.password, 500);
    const user = email ? await users.findByEmail(email) : null;
    const locked = user ? users.isLocked(user) : false;
    const matches = await verifyPassword(password, locked ? null : user?.passwordHash);
    if (!matches) {
      req.session.failedLogins = (req.session.failedLogins ?? 0) + 1;
      if (user && !locked) await users.recordFailedLogin(user.id);
      await logEvent(locked ? 'login.locked' : 'login.failure', { userID: user?.id ?? null, ip: req.ip });
      await sleep(Math.min(req.session.failedLogins * delayStepMs, MAXIMUM_DELAY_MS));
      return res.status(401).render('auth/login', { values: { email: text(req.body.email) }, problem: 'auth.problems.login' });
    }
    if (!user.emailVerifiedAt) {
      return res.status(403).render('auth/login', { values: { email }, problem: 'auth.problems.notVerified', resend: true });
    }
    await users.resetFailedLogins(user.id);
    await regenerate(req);
    req.session.user = { id: user.id, email: user.email, firstName: user.firstName };
    if (req.body.remember === 'on') req.session.cookie.maxAge = REMEMBER_MS;
    await saveSession(req);
    await devices.addDevice(user.id, req.sessionID, req.get('user-agent'));
    await logEvent('login', { userID: user.id, ip: req.ip });
    res.redirect(303, '/app/library');
  });

  router.post('/logout', async (req, res) => {
    const user = req.session.user;
    if (user) {
      await devices.removeDevice(req.sessionStore, user.id, req.sessionID);
      await logEvent('logout', { userID: user.id, ip: req.ip });
    }
    await regenerate(req);
    res.redirect(303, '/');
  });

  router.get('/forgot', (req, res) => {
    res.render('auth/forgot', { values: {} });
  });

  router.post('/forgot', limits.emails, async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const user = email ? await users.findByEmail(email) : null;
    if (user && await tokens.recentTokenCount(user.id, 'reset') < MAXIMUM_EMAILS_PER_HOUR) {
      mailer.send(emails.reset(req.lang, user.email, user.firstName, await tokens.createToken(user.id, 'reset')));
      await logEvent('password.reset.requested', { userID: user.id, ip: req.ip });
    }
    notice(res, 'checkEmailReset', { values: { email: email ?? '' } });
  });

  router.get('/reset', async (req, res) => {
    const found = await tokens.findToken('reset', req.query.token);
    if (!found) return notice(res, 'linkInvalid', { status: 400, link: { href: '/forgot', key: 'auth.forgot.title' } });
    res.render('auth/reset', { token: req.query.token, problems: {} });
  });

  router.post('/reset', limits.reset, async (req, res) => {
    const token = text(req.body.token, 100);
    const found = await tokens.findToken('reset', token);
    if (!found) return notice(res, 'linkInvalid', { status: 400, link: { href: '/forgot', key: 'auth.forgot.title' } });
    const user = await users.findByID(Number(found.user_id));
    const password = text(req.body.password, 500);
    const problems = {};
    const weakness = passwordProblem(password, { email: user.email, firstName: user.firstName });
    if (weakness) problems.password = `auth.problems.password.${weakness}`;
    else if (password !== text(req.body.confirm, 500)) problems.confirm = 'auth.problems.confirm';
    if (Object.keys(problems).length) return res.status(400).render('auth/reset', { token, problems });
    const passwordHash = await hashPassword(password);
    if (!await tokens.consumeToken('reset', token)) return notice(res, 'linkInvalid', { status: 400 });
    await users.updatePassword(user.id, passwordHash);
    await users.markVerified(user.id);
    await tokens.revokeTokens(user.id, 'reset');
    await devices.removeOtherDevices(req.sessionStore, user.id);
    await logEvent('password.reset', { userID: user.id, ip: req.ip });
    mailer.send(emails.passwordChanged(req.lang, user.email, user.firstName));
    notice(res, 'passwordReset', { link: { href: '/login', key: 'nav.login' } });
  });

  return router;
}

module.exports = { createAuthRoutes };
