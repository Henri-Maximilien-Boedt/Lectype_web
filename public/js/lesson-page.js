import { TypingEngine } from './core/engine.js';
import { TypingMetrics } from './core/metrics.js';
import { exercisesFor, starsFor, recordResult } from './core/learning.js';
import { makeSession } from './core/session-summary.js';
import { settings, sessions } from './storage.js';
import { OnScreenKeyboard } from './keyboard.js';
import { attachTypingInput } from './typing-input.js';
import { learningContext } from './learning-context.js';
import { summaryCard, percent } from './summary-card.js';

const main = document.querySelector('main.lesson');
const strings = JSON.parse(document.getElementById('learn-strings').textContent);
const input = document.getElementById('typing-input');
const intro = document.getElementById('intro');
const summary = document.getElementById('summary');
const textElement = document.getElementById('exercise-text');
const context = await learningContext();
const lesson = context.lesson(main.dataset.lessonId, context.progress());
if (!lesson) {
  window.location.replace('/app/learn');
  await new Promise(() => {});
}
const words = await (await fetch(`/content/words/${context.language}.json`)).json();
const keyboardElement = document.getElementById('keyboard');
const keyboard = new OnScreenKeyboard(keyboardElement, context.layout);
keyboardElement.hidden = !settings.get().showKeyboard;

const exercises = exercisesFor(lesson, words, (Date.now() ^ (Math.random() * 0x100000000)) >>> 0);
let exerciseIndex = 0;
let engine = new TypingEngine(exercises[0].text, 'strict');
let metrics = new TypingMetrics();
let pendingDeadKey = '';
let isShowingError = false;
let errorTimer;
let finished = false;

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  const exercise = exercises[exerciseIndex];
  document.getElementById('exercise-kind').textContent = strings.exercises[exercise.kind];
  textElement.replaceChildren(...engine.expected.map((character, index) => {
    const span = element('span', '', character.shown);
    if (index < engine.index) span.className = 'typed';
    else if (index === engine.index) span.className = isShowingError ? 'current error' : 'current';
    return span;
  }));
  document.getElementById('exercise-upcoming').textContent = exercises[exerciseIndex + 1]?.text ?? '';
  document.getElementById('lesson-progress').style.width = `${((exerciseIndex + engine.fractionCompleted) / exercises.length) * 100}%`;
  const active = intro.hidden && !finished;
  keyboard.highlight(active ? engine.current?.displayed ?? null : null, { error: isShowingError, pendingDeadKey: Boolean(pendingDeadKey) });
  updateMetrics();
}

function updateMetrics() {
  document.getElementById('wpm').textContent = Math.round(metrics.wordsPerMinute(performance.now() / 1000));
  document.getElementById('accuracy').textContent = percent(metrics.accuracy);
}

function flashError() {
  isShowingError = true;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    isShowingError = false;
    render();
  }, 250);
}

function start() {
  intro.hidden = true;
  input.focus();
  render();
}

function receive(text) {
  if (!intro.hidden) {
    if (text.includes(' ') || text.includes('\n')) start();
    return;
  }
  if (finished) return;
  const time = performance.now() / 1000;
  for (const character of text) {
    const expected = engine.current?.displayed;
    const result = engine.input(character);
    metrics.record(result, time, expected);
    if (result === 'incorrect') flashError();
    if (engine.isComplete && !advance()) return;
  }
  render();
}

function advance() {
  exerciseIndex += 1;
  if (exerciseIndex >= exercises.length) {
    finish();
    return false;
  }
  engine = new TypingEngine(exercises[exerciseIndex].text, 'strict');
  return true;
}

function finish() {
  finished = true;
  const result = { wordsPerMinute: metrics.finalWordsPerMinute, accuracy: metrics.accuracy, missedCharacters: metrics.missedCharacters };
  context.saveProgress(recordResult(context.progress(), lesson.id, result));
  const record = makeSession({ activity: 'lesson', itemID: lesson.id, title: strings.lessons[lesson.id] ?? lesson.id, metrics });
  if (record) sessions.record(record);
  const earned = starsFor(result.accuracy);
  const following = context.after(lesson);
  const starLine = element('p', earned ? 'big-stars earned' : 'big-stars', '★'.repeat(earned) + '☆'.repeat(3 - earned));
  const extra = earned ? [] : [element('p', 'muted', strings.failedHint)];
  const actions = [];
  if (earned && following) actions.push({ label: strings.nextLesson, primary: true, run: () => { window.location.href = `/app/lesson/${following.id}`; } });
  actions.push({ label: strings.retry, primary: !earned, run: () => window.location.reload() });
  actions.push({ label: strings.back, run: () => { window.location.href = '/app/learn'; } });
  if (earned && !following && lesson.id !== 'review') extra.push(element('p', '', strings.allDone));
  const card = summaryCard({
    heading: earned ? strings.lessonComplete : strings.lessonFailed,
    subtitle: strings.lessons[lesson.id],
    tiles: [[String(Math.round(result.wordsPerMinute)), strings.wpm], [percent(result.accuracy), strings.accuracy]],
    missed: metrics.mostMissedCharacters(3),
    timeline: metrics.timeline,
    strings,
    extra: [starLine, ...extra],
    actions,
  });
  summary.replaceChildren(card);
  summary.hidden = false;
  card.querySelector('button').focus();
  render();
}

document.getElementById('lesson-title').textContent = `${strings.stages[lesson.stage]} · ${strings.lessons[lesson.id] ?? lesson.id}`;
document.getElementById('lesson-keys').textContent = lesson.newCharacters.join(' ');
document.getElementById('intro-title').textContent = strings.lessons[lesson.id] ?? lesson.id;
document.getElementById('intro-keys').replaceChildren(...lesson.newCharacters.map((character) => element('span', 'key-chip', character)));
document.getElementById('start-lesson').addEventListener('click', start);
attachTypingInput(input, {
  onText: receive,
  onDeadKey(text) {
    pendingDeadKey = text;
    const indicator = document.getElementById('dead-key');
    indicator.textContent = text;
    indicator.hidden = !text;
    render();
  },
  onKey(event) {
    if (event.key === 'Escape') window.location.href = '/app/learn';
  },
});
main.addEventListener('click', (event) => {
  if (!event.target.closest('button, a')) input.focus();
});
setInterval(updateMetrics, 500);
render();
input.focus();
