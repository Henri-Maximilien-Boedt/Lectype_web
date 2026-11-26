import { bookmarks, currentBook } from './storage.js';

const strings = JSON.parse(document.getElementById('library-strings').textContent);

function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

for (const card of document.querySelectorAll('.book-card')) {
  if (!bookmarks.get('book', card.dataset.bookId)) continue;
  card.classList.add('started');
  card.querySelector('.started-label').hidden = false;
}

const latest = currentBook();
const card = latest && document.querySelector(`.book-card[data-book-id="${CSS.escape(latest.id)}"]`);
const section = document.getElementById('continue');
if (section && card) {
  section.href = `/app/type/${encodeURIComponent(latest.id)}?chapter=${latest.chapter}&page=${latest.page}`;
  document.getElementById('continue-cover').append(card.querySelector('.cover').cloneNode(true));
  document.getElementById('continue-title').textContent = card.querySelector('strong').textContent;
  const template = card.dataset.collection === 'true' ? strings.positionText : strings.position;
  document.getElementById('continue-position').textContent = format(template, { chapter: latest.chapter, page: latest.page });
  section.hidden = false;
}
