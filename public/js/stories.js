import { bookmarks } from './storage.js';

const strings = JSON.parse(document.getElementById('stories-strings').textContent);

for (const card of document.querySelectorAll('.story-card-data')) {
  const saved = bookmarks.get('story', card.dataset.storyId);
  if (!saved) continue;
  const total = Number(card.dataset.chapters);
  const done = saved.isFinished ? total : saved.results?.length ?? 0;
  card.querySelector('.bar').style.width = `${Math.min(done / total, 1) * 100}%`;
  card.classList.add('started');
  const button = card.querySelector('.button.primary');
  if (button && !saved.isFinished) button.textContent = strings.resume;
}
