import { settings } from './storage.js';
import { learningContext } from './learning-context.js';
import { starsOf, isUnlocked, nextLesson, completedCount, reviewLesson, REVIEW_LESSON_ID } from './core/learning.js';

const strings = JSON.parse(document.getElementById('learn-strings').textContent);
const context = await learningContext();
const progress = context.progress();
const LAYOUT_NAMES = { azerty: 'AZERTY', qwerty: 'QWERTY', qwertz: 'QWERTZ' };

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function keyChips(characters) {
  const row = element('span', 'key-chips');
  for (const character of characters.slice(0, 6)) row.append(element('span', 'key-chip', character));
  return row;
}

function stars(count) {
  return '★'.repeat(count) + '☆'.repeat(3 - count);
}

function lessonCard(lesson, index, upcoming) {
  const unlocked = isUnlocked(progress, context.lessons, lesson);
  const card = element(unlocked ? 'a' : 'span', 'lesson-card');
  if (unlocked) card.href = `/app/lesson/${lesson.id}`;
  if (!unlocked) card.classList.add('locked');
  if (upcoming?.id === lesson.id) card.classList.add('upcoming');
  const top = element('span', 'lesson-top');
  const earned = starsOf(progress, lesson.id);
  top.append(element('span', 'muted', String(index + 1)), element('span', earned ? 'stars earned' : 'stars', unlocked ? stars(earned) : '·'));
  card.append(top, element('span', 'lesson-name', strings.lessons[lesson.id] ?? lesson.id), keyChips(lesson.newCharacters));
  return card;
}

function render() {
  document.getElementById('layout-name').textContent = LAYOUT_NAMES[context.layout.name] ?? context.layout.name;
  document.getElementById('word-language').value = context.language;
  document.getElementById('done-count').textContent = String(completedCount(progress, context.lessons));
  document.getElementById('total-count').textContent = `/${context.lessons.length}`;
  const upcoming = nextLesson(progress, context.lessons);
  const nextLink = document.getElementById('next-lesson');
  if (upcoming) {
    nextLink.href = `/app/lesson/${upcoming.id}`;
    nextLink.textContent = `${strings.stages[upcoming.stage]} · ${strings.lessons[upcoming.id]} →`;
    nextLink.hidden = false;
  }
  const review = reviewLesson(progress, context.lessons);
  if (review) {
    const weak = document.getElementById('weak-keys');
    weak.href = `/app/lesson/${REVIEW_LESSON_ID}`;
    document.getElementById('weak-list').replaceChildren(keyChips(review.newCharacters));
    weak.hidden = false;
  }
  const stages = [...new Set(context.lessons.map((lesson) => lesson.stage))];
  document.getElementById('stages').replaceChildren(...stages.map((stage) => {
    const section = element('section', 'stage');
    const heading = element('div', 'stage-head');
    heading.append(element('h2', '', strings.stages[stage]), element('span', 'muted', strings.stageSubtitles[stage]));
    const grid = element('div', 'lesson-grid');
    context.lessons.forEach((lesson, index) => {
      if (lesson.stage === stage) grid.append(lessonCard(lesson, index, upcoming));
    });
    section.append(heading, grid);
    return section;
  }));
}

document.getElementById('word-language').addEventListener('change', (event) => {
  settings.set({ wordLanguage: event.target.value });
  window.location.reload();
});

render();
