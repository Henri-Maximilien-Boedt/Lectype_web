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

function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

function keyChips(characters, target = element('span', 'key-chips')) {
  target.replaceChildren(...characters.slice(0, 6).map((character) => element('span', 'key-chip', character)));
  return target;
}

function stars(count) {
  return '★'.repeat(count) + '☆'.repeat(3 - count);
}

function lessonCard(lesson, index, upcoming) {
  const unlocked = isUnlocked(progress, context.lessons, lesson);
  const item = element('li');
  const card = element(unlocked ? 'a' : 'span', 'lesson-card');
  if (unlocked) card.href = `/app/lesson/${lesson.id}`;
  if (!unlocked) card.classList.add('locked');
  if (upcoming?.id === lesson.id) card.classList.add('upcoming');
  const top = element('span', 'lesson-top');
  const earned = starsOf(progress, lesson.id);
  top.append(element('span', '', String(index + 1)), element('span', earned ? 'stars earned' : 'stars', unlocked ? stars(earned) : strings.lockedLabel));
  card.append(top, element('span', 'lesson-name', strings.lessons[lesson.id] ?? lesson.id), keyChips(lesson.newCharacters));
  item.append(card);
  return item;
}

function render() {
  const total = context.lessons.length;
  const done = completedCount(progress, context.lessons);
  document.getElementById('layout-name').textContent = LAYOUT_NAMES[context.layout.name] ?? context.layout.name;
  document.getElementById('word-language').value = context.language;
  document.getElementById('done-count').textContent = String(done);
  document.getElementById('total-count').textContent = `/ ${total}`;
  const upcoming = nextLesson(progress, context.lessons);
  if (upcoming) {
    const link = document.getElementById('next-lesson');
    link.href = `/app/lesson/${upcoming.id}`;
    document.getElementById('next-eyebrow').textContent = format(strings.nextEyebrow, { number: context.lessons.indexOf(upcoming) + 1, total });
    document.getElementById('next-title').textContent = format(strings.nextTitle, { stage: strings.stages[upcoming.stage], lesson: strings.lessons[upcoming.id] });
    keyChips(upcoming.newCharacters, document.getElementById('next-keys'));
    link.hidden = false;
  }
  const review = reviewLesson(progress, context.lessons);
  if (review) {
    const weak = document.getElementById('weak-keys');
    weak.href = `/app/lesson/${REVIEW_LESSON_ID}`;
    keyChips(review.newCharacters, document.getElementById('weak-list'));
    weak.hidden = false;
    document.getElementById('progress-card').hidden = true;
  }
  const stages = [...new Set(context.lessons.map((lesson) => lesson.stage))];
  document.getElementById('stages').replaceChildren(...stages.map((stage) => {
    const section = element('section', 'stage');
    const heading = element('div', 'stage-head');
    heading.append(element('h2', '', strings.stages[stage]), element('span', '', strings.stageSubtitles[stage]));
    const grid = element('ol', 'lesson-grid');
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
