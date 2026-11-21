const express = require('express');
const users = require('../tools/users');
const tokens = require('../tools/tokens');
const devices = require('../tools/devices');
const progress = require('../tools/progress');
const mailer = require('../tools/mailer');
const emails = require('../tools/emails');
const { logEvent, eventsFor } = require('../tools/security-log');
const { passwordProblem, hashPassword, verifyPassword } = require('../tools/passwords');
const { normalizeEmail, normalizeFirstName, text } = require('../tools/validation');
const { regenerate } = require('../middlewares/current-user');
const { describeUserAgent } = require('../tools/user-agent');

function requireUser(req, res, next) {
  if (!res.locals.currentUser) return res.redirect(303, '/login');
  return next();
}

async function renderAccount(req, res, { status = 200, notice = null, problems = {} } = {}) {
  const userID = res.locals.currentUser.id;
  const user = await users.findByID(userID);
  const deviceList = (await devices.listDevices(userID)).map((device) => ({
    id: device.id, label: describeUserAgent(device.userAgent), createdAt: device.createdAt, lastSeenAt: device.lastSeenAt,
    isCurrent: device.sessionID === req.sessionID,
  }));
  res.status(status).render('account/index', { user, devices: deviceList, events: await eventsFor(userID, 10), notice, problems });
}

function noticePage(res, key, { status = 200, link = null, clearLocal = false } = {}) {
  res.status(status).render('auth/notice', { key, link, values: {}, clearLocal });
}

async function confirmPassword(req, res) {
  const user = await users.findByID(res.locals.currentUser.id);
  const matches = await verifyPassword(text(req.body.currentPassword, 500), user.passwordHash);
  if (!matches) await logEvent('reauth.failure', { userID: user.id, ip: req.ip });
  return matches ? user : null;
}

function createAccountRoutes(limits) {
  const router = express.Router();

  router.get('/email/confirm', async (req, res) => {
    const consumed = await tokens.consumeToken('change-email', req.query.token);
    if (!consumed) return noticePage(res, 'linkInvalid', { status: 400 });
    const user = await users.findByID(consumed.userID);
    if (!user || await users.findByEmail(consumed.newEmail)) return noticePage(res, 'emailTaken', { status: 409 });
    try {
      await users.updateEmail(user.id, consumed.newEmail);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return noticePage(res, 'emailTaken', { status: 409 });
      throw error;
    }
    await tokens.revokeTokens(user.id, 'change-email');
    await logEvent('email.changed', { userID: user.id, ip: req.ip });
    mailer.send(emails.emailChanged(req.lang, user.email, user.firstName, consumed.newEmail));
    noticePage(res, 'emailChanged', { link: { href: '/account', key: 'nav.account' } });
  });

  router.use(requireUser);

  router.get('/', (req, res) => renderAccount(req, res));

  router.post('/name', async (req, res) => {
    const firstName = normalizeFirstName(req.body.firstName);
    if (!firstName) return renderAccount(req, res, { status: 400, problems: { firstName: 'auth.problems.firstName' } });
    await users.updateFirstName(res.locals.currentUser.id, firstName);
    res.locals.currentUser.firstName = firstName;
    req.session.user.firstName = firstName;
    renderAccount(req, res, { notice: 'account.notices.nameSaved' });
  });

  router.post('/email', limits.sensitive, async (req, res) => {
    const user = await confirmPassword(req, res);
    if (!user) return renderAccount(req, res, { status: 401, problems: { emailPassword: 'account.problems.password' } });
    const newEmail = normalizeEmail(req.body.email);
    if (!newEmail || newEmail === user.email) return renderAccount(req, res, { status: 400, problems: { email: 'auth.problems.email' } });
    if (!await users.findByEmail(newEmail) && await tokens.recentTokenCount(user.id, 'change-email') < 3) {
      const token = await tokens.createToken(user.id, 'change-email', { newEmail });
      mailer.send(emails.confirmNewEmail(req.lang, newEmail, user.firstName, token));
      mailer.send(emails.emailChangeRequested(req.lang, user.email, user.firstName, newEmail));
      await logEvent('email.change.requested', { userID: user.id, ip: req.ip });
    }
    renderAccount(req, res, { notice: 'account.notices.emailPending' });
  });

  router.post('/password', limits.sensitive, async (req, res) => {
    const user = await confirmPassword(req, res);
    if (!user) return renderAccount(req, res, { status: 401, problems: { currentPassword: 'account.problems.password' } });
    const password = text(req.body.password, 500);
    const weakness = passwordProblem(password, { email: user.email, firstName: user.firstName });
    if (weakness) return renderAccount(req, res, { status: 400, problems: { password: `auth.problems.password.${weakness}` } });
    if (password !== text(req.body.confirm, 500)) return renderAccount(req, res, { status: 400, problems: { confirm: 'auth.problems.confirm' } });
    await users.updatePassword(user.id, await hashPassword(password));
    await tokens.revokeTokens(user.id, 'reset');
    await devices.removeOtherDevices(req.sessionStore, user.id, req.sessionID);
    await logEvent('password.changed', { userID: user.id, ip: req.ip });
    mailer.send(emails.passwordChanged(req.lang, user.email, user.firstName));
    renderAccount(req, res, { notice: 'account.notices.passwordChanged' });
  });

  router.post('/devices/others', async (req, res) => {
    await devices.removeOtherDevices(req.sessionStore, res.locals.currentUser.id, req.sessionID);
    await logEvent('devices.removed', { userID: res.locals.currentUser.id, ip: req.ip });
    renderAccount(req, res, { notice: 'account.notices.devicesRemoved' });
  });

  router.post('/devices/:id', async (req, res) => {
    const userID = res.locals.currentUser.id;
    const sessionID = await devices.findDeviceByID(userID, Number.parseInt(req.params.id, 10));
    if (!sessionID) return renderAccount(req, res, { status: 404 });
    await devices.removeDevice(req.sessionStore, userID, sessionID);
    await logEvent('device.removed', { userID, ip: req.ip });
    if (sessionID === req.sessionID) {
      await regenerate(req);
      return res.redirect(303, '/');
    }
    return renderAccount(req, res, { notice: 'account.notices.devicesRemoved' });
  });

  router.get('/export', async (req, res) => {
    const user = await users.findByID(res.locals.currentUser.id);
    const data = {
      exportedAt: new Date().toISOString(),
      account: { email: user.email, firstName: user.firstName, createdAt: user.createdAt, emailVerifiedAt: user.emailVerifiedAt },
      devices: (await devices.listDevices(user.id)).map(({ userAgent, createdAt, lastSeenAt }) => ({ userAgent, createdAt, lastSeenAt })),
      securityEvents: await eventsFor(user.id, 1000),
      progress: await progress.exportData(user.id),
    };
    await logEvent('data.exported', { userID: user.id, ip: req.ip });
    res.set('Cache-Control', 'no-store');
    res.attachment('lectype-export.json');
    res.type('application/json').send(JSON.stringify(data, null, 2));
  });

  router.post('/delete', limits.sensitive, async (req, res) => {
    const user = await confirmPassword(req, res);
    if (!user) return renderAccount(req, res, { status: 401, problems: { deletePassword: 'account.problems.password' } });
    if (req.body.confirmDelete !== 'on') return renderAccount(req, res, { status: 400, problems: { confirmDelete: 'account.problems.confirmDelete' } });
    await devices.removeOtherDevices(req.sessionStore, user.id);
    await users.deleteUser(user.id);
    await logEvent('account.deleted', { ip: '' });
    mailer.send(emails.accountDeleted(req.lang, user.email, user.firstName));
    await regenerate(req);
    res.locals.currentUser = null;
    noticePage(res, 'accountDeleted', { clearLocal: true, link: { href: '/', key: 'errors.back' } });
  });

  return router;
}

module.exports = { createAccountRoutes };
