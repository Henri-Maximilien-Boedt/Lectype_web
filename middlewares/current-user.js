const devices = require('../tools/devices');
const users = require('../tools/users');

function regenerate(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

async function currentUser(req, res, next) {
  const user = req.session.user;
  res.locals.currentUser = null;
  if (!user) return next();
  const device = await devices.findDevice(user.id, req.sessionID);
  const fresh = device ? await users.findByID(user.id) : null;
  if (!fresh) {
    await regenerate(req);
    return next();
  }
  await devices.touchDevice(user.id, req.sessionID);
  req.session.user = { id: fresh.id, email: fresh.email, firstName: fresh.firstName };
  res.locals.currentUser = req.session.user;
  return next();
}

module.exports = currentUser;
module.exports.regenerate = regenerate;
