const devices = require('../tools/devices');

function regenerate(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

async function currentUser(req, res, next) {
  const user = req.session.user;
  res.locals.currentUser = null;
  if (!user) return next();
  const device = await devices.findDevice(user.id, req.sessionID);
  if (!device) {
    await regenerate(req);
    return next();
  }
  await devices.touchDevice(user.id, req.sessionID);
  res.locals.currentUser = user;
  return next();
}

module.exports = currentUser;
module.exports.regenerate = regenerate;
