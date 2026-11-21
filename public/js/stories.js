import { bookmarks } from './storage.js';

for (const card of document.querySelectorAll('.story-card')) {
  const saved = bookmarks.get('story', card.dataset.storyId);
  if (!saved) continue;
  const total = Number(card.dataset.chapters);
  const done = saved.isFinished ? total : saved.results?.length ?? 0;
  card.querySelector('.bar').style.width = `${Math.min(done / total, 1) * 100}%`;
  card.classList.add('started');
}
