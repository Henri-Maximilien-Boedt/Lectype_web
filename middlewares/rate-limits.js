const { rateLimit } = require('express-rate-limit');

const MINUTE = 60 * 1000;

function limiter(windowMs, limit) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).render('error', { status: 429, messageKey: 'errors.tooMany' }),
  });
}

const DEFAULT_LIMITS = { login: 10, signup: 5, emails: 5, reset: 10 };

function createRateLimits(limits = {}) {
  const chosen = { ...DEFAULT_LIMITS, ...limits };
  return {
    login: limiter(15 * MINUTE, chosen.login),
    signup: limiter(60 * MINUTE, chosen.signup),
    emails: limiter(60 * MINUTE, chosen.emails),
    reset: limiter(15 * MINUTE, chosen.reset),
  };
}

module.exports = { createRateLimits };
