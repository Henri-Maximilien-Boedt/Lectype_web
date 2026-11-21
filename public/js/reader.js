import * as Book from './core/book.js';
import { bookmarks } from './storage.js';

const main = document.querySelector('main.reader');
const spread = document.getElementById('spread');
const book = await (await fetch(`/content/books/${main.dataset.bookId}.json`)).json();
const all = Book.positions(book);
const wide = window.matchMedia('(min-width: 1000px)');
let index = startIndex();

function startIndex() {
  const saved = bookmarks.get('reader', book.id);
  const found = saved ? all.findIndex((item) => item.chapter === saved.chapter && item.page === saved.page) : -1;
  return Math.max(found, 0);
}

function pagesPerSpread() {
  return wide.matches ? 2 : 1;
}

function renderPage(position) {
  const article = document.createElement('article');
  article.className = 'reader-page';
  const chapter = Book.chapterOf(book, position);
  if (chapter.pages[0].number === position.page) {
    const heading = document.createElement('h2');
    heading.textContent = chapter.title;
    article.append(heading);
  }
  for (const paragraph of Book.pageAt(book, position).text.split(/\n+/)) {
    const element = document.createElement('p');
    element.textContent = paragraph;
    article.append(element);
  }
  const number = document.createElement('footer');
  number.textContent = String(all.indexOf(position) + 1);
  article.append(number);
  return article;
}

function render() {
  const count = pagesPerSpread();
  index -= index % count;
  const shown = all.slice(index, index + count);
  spread.replaceChildren(...shown.map(renderPage));
  const first = shown[0];
  document.getElementById('chapter-title').textContent = Book.chapterOf(book, first).title;
  document.getElementById('position').textContent = `${index + 1} / ${all.length}`;
  document.getElementById('type-here').href = `/app/type/${book.id}?chapter=${first.chapter}&page=${first.page}`;
  document.getElementById('previous').disabled = index === 0;
  document.getElementById('next').disabled = index + count >= all.length;
  bookmarks.set('reader', book.id, first);
}

function move(direction) {
  const target = index + direction * pagesPerSpread();
  if (target < 0 || target >= all.length) return;
  index = target;
  render();
  window.scrollTo({ top: 0 });
}

document.getElementById('previous').addEventListener('click', () => move(-1));
document.getElementById('next').addEventListener('click', () => move(1));
document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, textarea, select')) return;
  if (event.key === 'ArrowRight' || event.key === ' ') {
    event.preventDefault();
    move(1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    move(-1);
  }
});
wide.addEventListener('change', render);
render();
