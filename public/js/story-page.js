import { StorySession, transcript, emptyProgress } from './core/story.js';
import { makeSession } from './core/session-summary.js';
import { settings, bookmarks, sessions } from './storage.js';
import { loadLayout, OnScreenKeyboard } from './keyboard.js';
import { attachTypingInput } from './typing-input.js';
import { summaryCard, percent } from './summary-card.js';

const main = document.querySelector('main.story');
const strings = JSON.parse(document.getElementById('story-strings').textContent);
const input = document.getElementById('typing-input');
const summary = document.getElementById('summary');
const transcriptElement = document.getElementById('story-transcript');
const choiceList = document.getElementById('choice-list');
const picker = document.getElementById('chapter-picker');
const preferences = settings.get();
const story = await (await fetch(`/content/stories/${main.dataset.storyId}.json`)).json();
const keyboardElement = document.getElementById('keyboard');
const keyboard = new OnScreenKeyboard(keyboardElement, await loadLayout(preferences.keyboardLayout));
keyboardElement.hidden = !preferences.showKeyboard;

let session = new StorySession(story, bookmarks.get('story', story.id), preferences.strict ? 'strict' : 'tolerant');
let pendingDeadKey = '';
let errorTimer;
let isShowingError = false;

function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

function save() {
  bookmarks.set('story', story.id, session.savedProgress);
}

function characterSpans(engine, { cursor }) {
  return engine.expected.map((character, index) => {
    const span = document.createElement('span');
    span.textContent = character.displayed === '\n' ? ' ' : character.shown;
    if (index < engine.index) span.className = 'typed';
    else if (cursor && index === engine.index) span.className = isShowingError ? 'current error' : 'current';
    return span;
  });
}

function renderTranscript() {
  const paragraphs = transcript(session.completedSteps, session.choices);
  const step = session.currentStep;
  const continuesParagraph = step?.kind === 'sentence' && !step.startsParagraph && paragraphs.at(-1)?.kind === 'text';
  const nodes = paragraphs.map((paragraph) => {
    const element = document.createElement('p');
    element.className = paragraph.kind === 'choice' ? 'chosen' : '';
    element.textContent = paragraph.kind === 'choice' ? `↳ ${paragraph.text}` : paragraph.text;
    return element;
  });
  if (session.sentenceEngine) {
    const target = continuesParagraph ? nodes.at(-1) : document.createElement('p');
    if (continuesParagraph) target.append(' ');
    else nodes.push(target);
    target.append(...characterSpans(session.sentenceEngine, { cursor: true }));
  }
  transcriptElement.replaceChildren(...nodes);
}

function renderChoices() {
  const engine = session.choiceEngine;
  document.getElementById('choices').hidden = !engine;
  if (!engine) return;
  const leading = engine.candidates.findIndex((candidate, index) => engine.alive[index]);
  choiceList.replaceChildren(...engine.candidates.map((candidate, index) => {
    const item = document.createElement('li');
    item.className = engine.alive[index] ? 'story-option' : 'story-option dead';
    item.append(...characterSpans(candidate, { cursor: index === leading }));
    return item;
  }));
}

function renderHeader() {
  const chapter = session.chapter;
  document.getElementById('chapter-title').textContent = `${format(strings.chapterLabel, { number: chapter.number })} — ${chapter.title}`;
  const image = document.getElementById('story-image');
  const illustration = session.illustration;
  image.hidden = !illustration;
  if (illustration && !image.src.endsWith(illustration)) image.src = `/content/stories/images/${illustration}`;
  document.getElementById('story-place').textContent = chapter.place ?? '';
  picker.replaceChildren(...story.chapters.map((item) => {
    const option = document.createElement('option');
    option.value = String(item.number);
    option.textContent = `${item.number}. ${item.title}`;
    option.disabled = item.number > session.unlockedChapter;
    option.selected = item.number === chapter.number;
    return option;
  }));
}

function render() {
  renderHeader();
  renderTranscript();
  renderChoices();
  document.getElementById('chapter-progress').style.width = `${session.fractionCompleted * 100}%`;
  keyboard.highlight(session.current?.displayed ?? null, { error: isShowingError, pendingDeadKey: Boolean(pendingDeadKey) });
  followCursor();
  updateMetrics();
}

function followCursor() {
  const scroller = document.getElementById('story-scroll');
  const current = main.querySelector('.current');
  const top = current ? current.offsetTop - scroller.clientHeight / 2 : 0;
  scroller.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
}

function updateMetrics() {
  const now = performance.now() / 1000;
  document.getElementById('wpm').textContent = Math.round(session.metrics.wordsPerMinute(now));
  document.getElementById('accuracy').textContent = percent(session.metrics.accuracy);
}

function flashError() {
  isShowingError = true;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    isShowingError = false;
    render();
  }, 250);
}

function recordSession() {
  const record = makeSession({ activity: 'story', itemID: story.id, title: story.title, metrics: session.metrics });
  if (record) sessions.record(record);
}

function receive(text) {
  if (!summary.hidden) return;
  const time = performance.now() / 1000;
  for (const character of text) {
    if (session.receive(character, time) === 'incorrect') flashError();
    if (session.phase !== 'typing') break;
  }
  save();
  if (session.phase === 'chapterComplete') showChapterSummary();
  else if (session.phase === 'finished') showEnd();
  render();
}

function showChapterSummary() {
  recordSession();
  const result = session.lastResult;
  const isLast = !story.chapters[session.chapterIndex + 1];
  const card = summaryCard({
    heading: strings.chapterComplete,
    subtitle: session.chapter.title,
    tiles: [[String(Math.round(result.wordsPerMinute)), strings.wpm], [percent(result.accuracy), strings.accuracy]],
    missed: result.missedCharacters,
    timeline: session.metrics.timeline,
    strings,
    actions: [{ label: isLast ? strings.finish : strings.nextChapter, primary: true, run: next }],
  });
  summary.replaceChildren(card);
  summary.hidden = false;
  card.querySelector('button').focus();
}

function next() {
  summary.hidden = true;
  session.continueToNextChapter();
  save();
  if (session.phase === 'finished') showEnd();
  render();
  if (session.phase === 'typing') input.focus();
}

function chosenTexts() {
  const list = document.createElement('ol');
  list.className = 'choices-made';
  for (const chapter of story.chapters) {
    for (const segment of chapter.segments) {
      const picked = segment.kind === 'choice' ? segment.options[session.choices[segment.id]] : null;
      if (!picked) continue;
      const item = document.createElement('li');
      item.textContent = picked.text;
      list.append(item);
    }
  }
  return list;
}

function showEnd() {
  const results = session.results;
  const average = (key) => results.length ? results.reduce((sum, item) => sum + item[key], 0) / results.length : 0;
  const extra = [];
  if (Object.keys(session.choices).length) {
    const heading = document.createElement('h3');
    heading.textContent = strings.choicesMade;
    extra.push(heading, chosenTexts());
  }
  const card = summaryCard({
    heading: strings.theEnd,
    subtitle: story.title,
    tiles: [[String(Math.round(average('wordsPerMinute'))), strings.averageSpeed], [percent(average('accuracy')), strings.accuracy]],
    strings,
    extra,
    actions: [
      { label: strings.finish, primary: true, run: () => { window.location.href = '/app/stories'; } },
      { label: '↺', run: restart },
    ],
  });
  summary.replaceChildren(card);
  summary.hidden = false;
}

function restart() {
  if (!window.confirm(strings.restartConfirm)) return;
  recordSession();
  session = new StorySession(story, emptyProgress(), session.mode);
  save();
  summary.hidden = true;
  render();
  input.focus();
}

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
    if (event.key === 'Escape') window.location.href = '/app/stories';
  },
});
picker.addEventListener('change', () => {
  recordSession();
  session.startChapter(Number(picker.value));
  save();
  render();
  input.focus();
});
document.getElementById('restart-story').addEventListener('click', restart);
main.addEventListener('click', (event) => {
  if (!event.target.closest('button, a, select')) input.focus();
});
window.addEventListener('pagehide', recordSession);

setInterval(updateMetrics, 500);

render();
if (session.phase === 'finished') showEnd();
input.focus();
