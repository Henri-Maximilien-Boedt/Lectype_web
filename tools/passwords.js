const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const COST = 12;
const MINIMUM_LENGTH = 12;
const MAXIMUM_BYTES = 72;
const COMMON = new Set(fs.readFileSync(path.join(__dirname, 'data', 'common-passwords.txt'), 'utf8')
  .split('\n').map((line) => line.trim().toLowerCase()).filter(Boolean));
const TIMING_HASH = bcrypt.hashSync('lectype-timing-reference', COST);

function passwordProblem(password, { email = '', firstName = '' } = {}) {
  if (typeof password !== 'string' || [...password].length < MINIMUM_LENGTH) return 'tooShort';
  if (Buffer.byteLength(password, 'utf8') > MAXIMUM_BYTES) return 'tooLong';
  const lowered = password.toLowerCase();
  if (COMMON.has(lowered) || new Set(lowered).size <= 3) return 'tooCommon';
  const localPart = email.split('@')[0].toLowerCase();
  if ((localPart.length >= 4 && lowered.includes(localPart)) || (firstName.length >= 4 && lowered.includes(firstName.toLowerCase()))) return 'personal';
  return null;
}

function hashPassword(password) {
  return bcrypt.hash(password, COST);
}

async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > MAXIMUM_BYTES) {
    await bcrypt.compare('x', TIMING_HASH);
    return false;
  }
  return bcrypt.compare(password, hash ?? TIMING_HASH).then((matches) => Boolean(hash) && matches);
}

module.exports = { passwordProblem, hashPassword, verifyPassword, MINIMUM_LENGTH, COST };
