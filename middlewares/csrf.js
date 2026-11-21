const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function tokensMatch(expected, submitted) {
  if (typeof submitted !== 'string' || submitted.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(submitted));
}

function csrf(req, res, next) {
  const token = ensureToken(req);
  res.locals.csrfToken = token;
  if (SAFE_METHODS.has(req.method)) return next();
  const submitted = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!tokensMatch(token, submitted)) {
    if (req.is('application/json')) return res.status(403).json({ error: 'csrf' });
    return res.status(403).render('error', { status: 403, messageKey: 'errors.csrf' });
  }
  return next();
}

module.exports = csrf;
module.exports.ensureToken = ensureToken;
