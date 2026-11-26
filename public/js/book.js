import { bookmarks } from './storage.js';

const main = document.querySelector('main.book-detail');
const strings = JSON.parse(document.getElementById('book-strings').textContent);
const saved = bookmarks.get('book', main.dataset.bookId);

function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

if (saved) {
  const link = document.getElementById('type-link');
  link.href = `/app/type/${encodeURIComponent(main.dataset.bookId)}?chapter=${saved.chapter}&page=${saved.page}`;
  link.textContent = strings.continue;
  document.getElementById('book-status').textContent = format(strings.inProgress, {
    position: format(strings.position, { chapter: saved.chapter, page: saved.page }).toLowerCase(),
  });
}
