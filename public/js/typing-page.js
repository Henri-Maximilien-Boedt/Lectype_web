import { TypingEngine } from './core/engine.js';
import { TypingMetrics } from './core/metrics.js';
import * as Book from './core/book.js';
import { makeSession } from './core/session-summary.js';
import { settings, bookmarks, sessions } from './storage.js';
import { loadLayout, OnScreenKeyboard } from './keyboard.js';
import { summaryCard, percent, duration } from './summary-card.js';
import { attachTypingInput } from './typing-input.js';

const main = document.querySelector('main.typing');
const strings = JSON.parse(document.getElementById('typing-strings').textContent);
const input = document.getElementById('typing-input');
const pageWindow = document.getElementById('page-window');
const pageText = document.getElementById('page-text');
const summary = document.getElementById('summary');
const MAX_LINES = 7;
const LINES_ABOVE = 2;

const preferences = settings.get();
const mode = preferences.strict ? 'strict' : 'tolerant';
const book = await (await fetch(`/content/books/${main.dataset.bookId}.json`)).json();
const keyboardElement = document.getElementById('keyboard');
const keyboard = new OnScreenKeyboard(keyboardElement, await loadLayout(preferences.keyboardLayout));
keyboardElement.hidden = !preferences.showKeyboard;

let position = startPosition();
let engine;
let metrics = new TypingMetrics();
let spans = [];
let pendingDeadKey = '';
let errorTimer;

function startPosition() {
  const requested = main.dataset.startChapter ? { chapter: Number(main.dataset.startChapter), page: Number(main.dataset.startPage) } : null;
  const saved = bookmarks.get('book', book.id);
  const candidate = requested ?? (saved ? { chapter: saved.chapter, page: saved.page } : null);
  return candidate && Book.pageAt(book, candidate) ? candidate : Book.positions(book)[0];
}

function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

function loadPage() {
  engine = new TypingEngine(Book.pageAt(book, position).text, mode);
  spans = engine.expected.map((character) => {
    const span = document.createElement('span');
    span.textContent = character.shown;
    if (character.displayed === '\n') span.classList.add('newline');
    return span;
  });
  pageText.replaceChildren(...spans);
  const chapter = Book.chapterOf(book, position);
  document.getElementById('chapter-title').textContent = Book.isCollection(book) ? chapter.title : `${strings.chapter} ${chapter.label} · ${chapter.title}`;
  document.getElementById('page-label').textContent = format(strings.page, { page: position.page, count: chapter.pages.length });
  document.getElementById('previous-page').disabled = !Book.previous(book, position);
  document.getElementById('next-page').disabled = !Book.next(book, position);
  refresh();
}

function refresh() {
  spans.forEach((span, index) => {
    span.className = span.classList.contains('newline') ? 'newline' : '';
    if (index < engine.index) span.classList.add('typed');
    else if (index === engine.index) span.classList.add('current');
  });
  const chapter = Book.chapterOf(book, position);
  const pageIndex = chapter.pages.findIndex((page) => page.number === position.page);
  document.getElementById('chapter-progress').style.width = `${((pageIndex + engine.fractionCompleted) / chapter.pages.length) * 100}%`;
  keyboard.highlight(engine.current?.displayed ?? null, { pendingDeadKey: Boolean(pendingDeadKey) });
  followCursor();
}

function followCursor() {
  const lineHeight = parseFloat(getComputedStyle(pageText).lineHeight);
  const reserved = keyboardElement.hidden ? 360 : 600;
  const available = window.innerHeight - reserved;
  const visible = Math.max(3, Math.min(MAX_LINES, Math.floor(available / lineHeight)));
  pageWindow.style.height = `${visible * lineHeight}px`;
  const current = spans[Math.min(engine.index, spans.length - 1)];
  if (!current) return;
  const totalLines = Math.round(pageText.scrollHeight / lineHeight);
  const cursorLine = Math.round(current.offsetTop / lineHeight);
  const first = Math.min(Math.max(cursorLine - LINES_ABOVE, 0), Math.max(totalLines - visible, 0));
  pageText.style.transform = `translateY(${-first * lineHeight}px)`;
}

function flashError() {
  keyboard.highlight(engine.current?.displayed ?? null, { error: true });
  spans[engine.index]?.classList.add('error');
  clearTimeout(errorTimer);
  errorTimer = setTimeout(refresh, 250);
}

function receive(text) {
  if (!summary.hidden) return;
  const time = performance.now() / 1000;
  for (const character of text) {
    const expected = engine.current?.displayed;
    const result = engine.input(character);
    metrics.record(result, time, expected);
    if (result === 'incorrect') flashError();
    if (engine.isComplete) {
      advance();
      return;
    }
  }
  refresh();
}

function advance() {
  const finished = Book.chapterOf(book, position);
  const following = Book.next(book, position);
  if (!following || following.chapter !== position.chapter) {
    showSummary(finished, following);
  }
  if (following) {
    position = following;
    saveBookmark();
    loadPage();
  }
}

function saveBookmark() {
  const saved = bookmarks.get('book', book.id);
  bookmarks.set('book', book.id, Book.furthest(book, saved && { chapter: saved.chapter, page: saved.page }, position));
}

function endSegment() {
  const session = makeSession({ activity: 'book', itemID: book.id, title: book.title, metrics });
  if (session) sessions.record(session);
  const ended = metrics;
  metrics = new TypingMetrics();
  return ended;
}

function showSummary(chapter, following) {
  const chapterMetrics = endSegment();
  const collection = Book.isCollection(book);
  const nextChapter = following ? Book.chapterOf(book, following) : null;
  const card = summaryCard({
    eyebrow: collection ? strings.textComplete : strings.complete,
    heading: chapter.title,
    subtitle: format(strings.pagesTyped, { count: chapter.pages.length }),
    tiles: [
      [String(Math.round(chapterMetrics.finalWordsPerMinute)), strings.wpm],
      [percent(chapterMetrics.accuracy), strings.accuracy],
      [duration(chapterMetrics.activeDuration), strings.timeTyped],
    ],
    missed: chapterMetrics.mostMissedCharacters(3),
    timeline: chapterMetrics.timeline,
    strings,
    actions: [
      nextChapter
        ? { label: format(strings.nextLabel, { label: collection ? strings.nextText : strings.nextChapter, title: nextChapter.title }), primary: true, run: () => { summary.hidden = true; input.focus(); } }
        : { label: strings.finish, primary: true, run: () => { window.location.href = `/app/book/${book.id}`; } },
      { label: strings.backToBook, run: () => { window.location.href = `/app/book/${book.id}`; } },
    ],
  });
  summary.replaceChildren(card);
  summary.hidden = false;
  card.querySelector('button').focus();
}

function jump(target) {
  if (!target) return;
  position = target;
  loadPage();
  input.focus();
}

attachTypingInput(input, {
  onText: receive,
  onDeadKey(text) {
    pendingDeadKey = text;
    const indicator = document.getElementById('dead-key');
    indicator.textContent = text;
    indicator.hidden = !text;
    refresh();
  },
  onKey(event) {
    if (event.key === 'Escape') window.location.href = `/app/book/${book.id}`;
    if (event.ctrlKey && event.key === 'ArrowLeft') { event.preventDefault(); jump(Book.previous(book, position)); }
    if (event.ctrlKey && event.key === 'ArrowRight') { event.preventDefault(); jump(Book.next(book, position)); }
  },
});
document.getElementById('previous-page').addEventListener('click', () => jump(Book.previous(book, position)));
document.getElementById('next-page').addEventListener('click', () => jump(Book.next(book, position)));
document.getElementById('restart-page').addEventListener('click', () => jump(position));
main.addEventListener('click', (event) => {
  if (!event.target.closest('button, a')) input.focus();
});
window.addEventListener('resize', followCursor);
window.addEventListener('pagehide', endSegment);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') endSegment(); });

setInterval(() => {
  const now = performance.now() / 1000;
  document.getElementById('wpm').textContent = Math.round(metrics.wordsPerMinute(now));
  document.getElementById('accuracy').textContent = `${Math.round(metrics.accuracy * 100)} %`;
  const seconds = Math.floor(metrics.elapsed(now));
  document.getElementById('elapsed').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}, 500);

loadPage();
input.focus();
