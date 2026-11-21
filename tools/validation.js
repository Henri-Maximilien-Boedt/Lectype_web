const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/u;
const MAXIMUM_EMAIL_LENGTH = 254;
const MAXIMUM_NAME_LENGTH = 60;

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= MAXIMUM_EMAIL_LENGTH && EMAIL.test(email) ? email : null;
}

function normalizeFirstName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/[\p{Cc}\p{Cf}<>]/gu, '').replace(/\s+/g, ' ').trim();
  return name.length >= 1 && [...name].length <= MAXIMUM_NAME_LENGTH ? name : null;
}

function text(value, maximum = 200) {
  return typeof value === 'string' ? value.slice(0, maximum) : '';
}

module.exports = { normalizeEmail, normalizeFirstName, text };
