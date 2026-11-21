import { bookmarks, currentBook } from './storage.js';

const strings = { continue: document.documentElement.lang === 'fr' ? 'Reprendre la lecture' : 'Continue reading' };

for (const card of document.querySelectorAll('.book-card')) {
  const saved = bookmarks.get('book', card.dataset.bookId);
  if (!saved) continue;
  card.classList.add('started');
}

const latest = currentBook();
const section = document.getElementById('continue');
const card = latest && document.querySelector(`.book-card[data-book-id="${CSS.escape(latest.id)}"]`);
if (section && card) {
  const link = document.createElement('a');
  link.className = 'button primary';
  link.href = `/app/type/${encodeURIComponent(latest.id)}`;
  link.textContent = `${strings.continue} — ${card.querySelector('strong').textContent}`;
  section.append(link);
  section.hidden = false;
}
