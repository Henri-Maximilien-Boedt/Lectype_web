const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const ID_PATTERN = /^[a-z0-9-]+$/;
const KINDS = ['novel', 'tale', 'fable', 'story', 'poem'];

let cachedIndex = null;
const cachedBooks = new Map();
const cachedStories = new Map();

function index() {
  if (!cachedIndex) cachedIndex = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'index.json'), 'utf8'));
  return cachedIndex;
}

function readItem(folder, id, cache) {
  if (!ID_PATTERN.test(String(id))) return null;
  if (cache.has(id)) return cache.get(id);
  const file = path.join(CONTENT_DIR, folder, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  const item = JSON.parse(fs.readFileSync(file, 'utf8'));
  cache.set(id, item);
  return item;
}

function book(id) {
  return readItem('books', id, cachedBooks);
}

function story(id) {
  return readItem('stories', id, cachedStories);
}

function normalize(text) {
  return String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/’/g, "'").toLowerCase();
}

function searchBooks(books, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return books;
  return books.filter((item) => {
    const haystack = normalize(`${item.title} ${item.author}`);
    return terms.every((term) => haystack.includes(term));
  });
}

function searchTexts(query, limit = 40) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const results = [];
  for (const entry of index().books) {
    if (entry.kind === 'novel') continue;
    const full = book(entry.id);
    for (const chapter of full.chapters) {
      const haystack = normalize(`${chapter.title} ${chapter.author ?? ''}`);
      if (terms.every((term) => haystack.includes(term))) {
        results.push({ bookID: entry.id, bookTitle: entry.title, chapterNumber: chapter.number, title: chapter.title });
        if (results.length === limit) return results;
      }
    }
  }
  return results;
}

module.exports = { index, book, story, searchBooks, searchTexts, KINDS, ID_PATTERN };
