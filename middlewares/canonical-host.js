function canonicalHost(host) {
  return function redirectToCanonical(req, res, next) {
    if (!host) return next();
    if (req.secure && req.headers.host === host) return next();
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  };
}

module.exports = canonicalHost;
