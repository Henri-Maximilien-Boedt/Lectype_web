import { DEAD_KEYS } from './layouts.js';

export const STAR_THRESHOLDS = [0.9, 0.95, 0.98];
export const REVIEW_LESSON_ID = 'review';
export const REVIEW_SIZE = 5;
export const WORD_LANGUAGES = ['fr', 'en'];
export const HOME_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];

const KEY_STEPS = [
  ['home-index', 'homeRow', ['KeyF', 'KeyJ']],
  ['home-middle', 'homeRow', ['KeyD', 'KeyK']],
  ['home-ring', 'homeRow', ['KeyS', 'KeyL']],
  ['home-pinky', 'homeRow', ['KeyA', 'Semicolon']],
  ['home-center', 'homeRow', ['KeyG', 'KeyH']],
  ['top-middle', 'topRow', ['KeyE', 'KeyI']],
  ['top-index', 'topRow', ['KeyR', 'KeyU']],
  ['top-center', 'topRow', ['KeyT', 'KeyY']],
  ['top-ring', 'topRow', ['KeyW', 'KeyO']],
  ['top-pinky', 'topRow', ['KeyQ', 'KeyP']],
  ['bottom-index', 'bottomRow', ['KeyV', 'KeyM']],
  ['bottom-middle', 'bottomRow', ['KeyC', 'Comma']],
  ['bottom-ring', 'bottomRow', ['KeyX', 'Period']],
  ['bottom-pinky', 'bottomRow', ['KeyZ', 'Slash']],
  ['bottom-center', 'bottomRow', ['KeyB', 'KeyN']],
];
const EXTRA_LETTER_KEYS = ['Quote', 'BracketLeft', 'BracketRight', 'Backslash', 'IntlBackslash', 'Backquote'];
const ACCENTED = { fr: 'éèàùçêâîôûëïœ', de: 'äöüß', es: 'áéíóúñü', it: 'àèéìòù', pt: 'áâãàçéêíóôõú' };
const PUNCTUATION = [...",.;:!?'-"];
const DIGITS = [...'1234567890'];
const LINE_LENGTH = 40;
const MINIMUM_WORD_COUNT = 6;
const DRILL_LINE_COUNT = 3;
const WORD_LINE_COUNT = 4;

export function isLetter(character) {
  return /^\p{L}$/u.test(character);
}

export function isLowercaseLetter(character) {
  return isLetter(character) && character === character.toLowerCase() && character !== character.toUpperCase();
}

export function baseCharacter(code, layout) {
  if ((DEAD_KEYS[layout.name] ?? []).includes(code)) return null;
  const base = layout.keys[code]?.base;
  if (!base || [...base].length !== 1 || /\s|\p{Cc}/u.test(base)) return null;
  return base;
}

function isTypeable(character, layout) {
  return layout.strokes.has(character);
}

function isDirect(character, layout) {
  const strokes = layout.strokes.get(character);
  return Boolean(strokes) && strokes.length === 1 && !strokes[0].shift;
}

export function lessonsFor(layout, language) {
  const lessons = [];
  const known = [];
  const add = (id, stage, characters) => {
    const fresh = [];
    for (const character of characters) {
      if (!known.includes(character) && !fresh.includes(character)) fresh.push(character);
    }
    if (!fresh.length) return;
    known.push(...fresh);
    lessons.push({ id, stage, newCharacters: fresh, knownCharacters: [...known] });
  };
  for (const [id, stage, codes] of KEY_STEPS) add(id, stage, codes.map((code) => baseCharacter(code, layout)).filter(Boolean));
  add('extra-letters', 'bottomRow', EXTRA_LETTER_KEYS.map((code) => baseCharacter(code, layout)).filter((character) => character && isLetter(character)));
  add('capitals', 'capitals', known.filter(isLetter).map((character) => character.toUpperCase()).filter((character) => [...character].length === 1 && isTypeable(character, layout)));
  add('punctuation', 'punctuation', PUNCTUATION.filter((character) => isTypeable(character, layout)));
  const accents = [...(ACCENTED[language] ?? '')].filter((character) => isTypeable(character, layout));
  add('accents-direct', 'accents', accents.filter((character) => isDirect(character, layout)));
  add('accents-composed', 'accents', accents.filter((character) => !isDirect(character, layout)));
  add('numbers', 'numbers', DIGITS.filter((character) => isTypeable(character, layout)));
  return lessons;
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function wordsUsing(rankedWords, allowed, preferred) {
  const usable = rankedWords.filter((word) => [...word].every((character) => allowed.has(character)));
  const hasPreferred = (word) => [...word].some((character) => preferred.has(character));
  return [...usable.filter(hasPreferred), ...usable.filter((word) => !hasPreferred(word))];
}

export function exercisesFor(lesson, rankedWords, seed) {
  const random = seededRandom(seed);
  const pick = (items) => items[Math.floor(random() * items.length)];
  const between = (low, high) => low + Math.floor(random() * (high - low + 1));
  const fresh = lesson.newCharacters;
  const knownLetters = lesson.knownCharacters.filter(isLowercaseLetter);
  const drillPool = [...fresh, ...fresh, ...lesson.knownCharacters.filter((character) => isLowercaseLetter(character) || fresh.includes(character))];
  const letters = (count) => Array.from({ length: count }, () => pick(knownLetters.length ? knownLetters : fresh)).join('');

  const line = (makeToken) => {
    const tokens = [];
    let length = 0;
    while (length < LINE_LENGTH) {
      const token = makeToken();
      tokens.push(token);
      length += [...token].length + 1;
    }
    return tokens.join(' ');
  };

  const drillToken = () => {
    switch (lesson.stage) {
      case 'capitals': return pick(fresh) + letters(between(1, 3));
      case 'numbers': return Array.from({ length: between(2, 4) }, () => pick(fresh)).join('');
      case 'punctuation': return letters(between(2, 4)) + pick(fresh);
      default: return Array.from({ length: between(2, 4) }, () => pick(drillPool)).join('');
    }
  };

  const discovery = () => {
    if (fresh.length <= 4) {
      const repeated = fresh.map((character) => Array(4).fill(character.repeat(3)).join(' '));
      if (fresh.length === 1) return [...repeated, fresh[0].repeat(3)];
      const tokens = [];
      fresh.forEach((first, index) => {
        const second = fresh[(index + 1) % fresh.length];
        tokens.push(`${first}${second}${first}`, `${second}${first}${second}`);
      });
      return [...repeated, tokens.slice(0, 8).join(' ')];
    }
    const lines = [];
    for (let start = 0; start < fresh.length; start += 8) lines.push(fresh.slice(start, start + 8).map((character) => character + character).join(' '));
    return lines;
  };

  const preferred = new Set(fresh.map((character) => character.toLowerCase()));
  const choices = wordsUsing(rankedWords, new Set(knownLetters), preferred).slice(0, 60);
  const wordToken = () => {
    const word = choices[Math.floor(random() * Math.min(choices.length, 30))];
    switch (lesson.stage) {
      case 'capitals': return word[0].toUpperCase() + word.slice(1);
      case 'numbers': return random() < 0.5 ? word : pick(fresh) + pick(fresh);
      case 'punctuation': return word + pick(fresh);
      default: return word;
    }
  };

  const exercises = discovery().map((text) => ({ kind: 'discovery', text }));
  for (let index = 0; index < DRILL_LINE_COUNT; index += 1) exercises.push({ kind: 'drill', text: line(drillToken) });
  const useWords = choices.length >= MINIMUM_WORD_COUNT;
  for (let index = 0; index < WORD_LINE_COUNT; index += 1) {
    exercises.push(useWords ? { kind: 'words', text: line(wordToken) } : { kind: 'drill', text: line(drillToken) });
  }
  return exercises;
}

export function starsFor(accuracy) {
  return STAR_THRESHOLDS.filter((threshold) => accuracy >= threshold).length;
}

export function starsOf(progress, lessonID) {
  return progress.records?.[lessonID]?.stars ?? 0;
}

export function isUnlocked(progress, lessons, lesson) {
  const index = lessons.findIndex((item) => item.id === lesson.id);
  return index === 0 || (index > 0 && starsOf(progress, lessons[index - 1].id) > 0);
}

export function nextLesson(progress, lessons) {
  return lessons.find((lesson) => starsOf(progress, lesson.id) === 0 && isUnlocked(progress, lessons, lesson)) ?? null;
}

export function completedCount(progress, lessons) {
  return lessons.filter((lesson) => starsOf(progress, lesson.id) > 0).length;
}

export function recordResult(progress, lessonID, result) {
  const records = { ...(progress.records ?? {}) };
  const record = { stars: 0, bestWordsPerMinute: 0, missedCharacters: {}, ...(records[lessonID] ?? {}) };
  const missed = { ...record.missedCharacters };
  for (const [character, count] of Object.entries(result.missedCharacters)) missed[character] = (missed[character] ?? 0) + count;
  records[lessonID] = {
    stars: Math.max(record.stars, starsFor(result.accuracy)),
    bestWordsPerMinute: Math.max(record.bestWordsPerMinute, result.wordsPerMinute),
    missedCharacters: missed,
  };
  return { ...progress, records };
}

export function weakCharacters(progress, limit, allowed) {
  const totals = new Map();
  for (const record of Object.values(progress.records ?? {})) {
    for (const [character, count] of Object.entries(record.missedCharacters ?? {})) {
      if ([...character].length !== 1 || !allowed.has(character)) continue;
      totals.set(character, (totals.get(character) ?? 0) + count);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([character]) => character);
}

export function reviewLesson(progress, lessons) {
  const reached = [...lessons].reverse().find((lesson) => isUnlocked(progress, lessons, lesson));
  if (!reached) return null;
  const weak = weakCharacters(progress, REVIEW_SIZE, new Set(reached.knownCharacters));
  if (!weak.length) return null;
  return { id: REVIEW_LESSON_ID, stage: 'homeRow', newCharacters: weak, knownCharacters: reached.knownCharacters };
}
