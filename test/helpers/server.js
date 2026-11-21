process.env.DATABASE_URL ??= ':memory:';

const { createApp } = require('../../app');
const db = require('../../tools/db');
const mailer = require('../../tools/mailer');
const { LibsqlSessionStore } = require('../../tools/session-store');

const outbox = [];
mailer.useTransport(async (message) => { outbox.push(message); });

async function startTestServer(options = {}) {
  await db.ensureSchema();
  const store = new LibsqlSessionStore();
  const relaxed = { login: 1000, signup: 1000, emails: 1000, reset: 1000, sensitive: 1000 };
  const app = createApp({ sessionStore: store, authDelayMs: 1, rateLimits: options.realLimits ? {} : relaxed });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, store, close: () => new Promise((resolve) => server.close(resolve)) };
}

function withoutTokens(html) {
  return html.replace(/(value|content)="[0-9a-f]{64}"/g, '');
}

function lastEmailTo(address) {
  return [...outbox].reverse().find((message) => message.to === address) ?? null;
}

class Browser {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }

  async request(path, { method = 'GET', form, json, csrf } = {}) {
    const headers = {};
    if (json) {
      headers['content-type'] = 'application/json';
      if (csrf) headers['x-csrf-token'] = csrf;
    }
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    if (json) body = JSON.stringify(json);
    const response = await fetch(this.base + path, { method, headers, body, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const [name, ...value] = pair.split('=');
      this.cookies.set(name.trim(), value.join('='));
    }
    response.text = await response.text();
    return response;
  }

  async csrf(path = '/login') {
    const page = await this.request(path);
    return page.text.match(/name="_csrf" value="([^"]+)"/)[1];
  }

  async post(path, form, from = '/login') {
    return this.request(path, { method: 'POST', form: { _csrf: await this.csrf(from), ...form } });
  }

  async json(path, payload) {
    const page = await this.request('/app/library');
    const csrf = page.text.match(/name="csrf-token" content="([^"]+)"/)[1];
    const response = await this.request(path, { method: 'POST', json: payload, csrf });
    return { status: response.status, body: response.status === 200 ? JSON.parse(response.text) : null };
  }

  get sessionID() {
    return this.cookies.get('lectype.sid');
  }
}

module.exports = { startTestServer, Browser, outbox, lastEmailTo, withoutTokens };
