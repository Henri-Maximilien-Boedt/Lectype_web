import { bookmarks } from './storage.js';

const main = document.querySelector('main.book-detail');
const saved = bookmarks.get('book', main.dataset.bookId);
if (saved) {
  const link = document.getElementById('type-link');
  link.href = `/app/type/${encodeURIComponent(main.dataset.bookId)}?chapter=${saved.chapter}&page=${saved.page}`;
  link.textContent = document.documentElement.lang === 'fr' ? 'Continuer' : 'Continue';
}
