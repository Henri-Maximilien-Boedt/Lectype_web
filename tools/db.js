const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function databaseURL() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return `file:${path.join(DATA_DIR, 'lectype.db')}`;
}

const db = createClient({ url: databaseURL() });

async function ensureSchema(client = db) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.execute('PRAGMA foreign_keys = ON');
  await client.executeMultiple(schema);
}

module.exports = db;
module.exports.ensureSchema = ensureSchema;
module.exports.DATA_DIR = DATA_DIR;
