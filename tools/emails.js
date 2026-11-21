const { translate } = require('./i18n');

function baseURL() {
  return (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
}

function link(pathname, token) {
  return `${baseURL()}${pathname}?token=${encodeURIComponent(token)}`;
}

function compose(lang, key, to, values = {}) {
  const t = (name) => translate(lang, `emails.${key}.${name}`, values);
  return { to, subject: t('subject'), text: `${t('body')}\n\n${translate(lang, 'emails.signature')}` };
}

module.exports = {
  verify: (lang, to, firstName, token) => compose(lang, 'verify', to, { firstName, link: link('/verify', token) }),
  accountExists: (lang, to) => compose(lang, 'accountExists', to, { login: `${baseURL()}/login`, forgot: `${baseURL()}/forgot` }),
  reset: (lang, to, firstName, token) => compose(lang, 'reset', to, { firstName, link: link('/reset', token) }),
  passwordChanged: (lang, to, firstName) => compose(lang, 'passwordChanged', to, { firstName, forgot: `${baseURL()}/forgot` }),
  confirmNewEmail: (lang, to, firstName, token) => compose(lang, 'confirmNewEmail', to, { firstName, link: link('/account/email/confirm', token) }),
  emailChangeRequested: (lang, to, firstName, newEmail) => compose(lang, 'emailChangeRequested', to, { firstName, newEmail }),
  emailChanged: (lang, to, firstName, newEmail) => compose(lang, 'emailChanged', to, { firstName, newEmail }),
  accountDeleted: (lang, to, firstName) => compose(lang, 'accountDeleted', to, { firstName }),
  baseURL,
};
