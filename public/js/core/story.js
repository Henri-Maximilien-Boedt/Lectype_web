import { TypingEngine } from './engine.js';
import { TypingMetrics } from './metrics.js';

export const MISSED_CHARACTER_COUNT = 3;

export function emptyProgress() {
  return { chapterNumber: 1, stepIndex: 0, choices: {}, results: [], isFinished: false, unlockedChapter: 1, discoveredOptions: {} };
}

function sentenceSteps(paragraphs) {
  return paragraphs.flatMap((paragraph) => paragraph.map((text, index) => ({ kind: 'sentence', text, startsParagraph: index === 0 })));
}

export function storySteps(chapter, choices, fallbacks = {}) {
  const steps = [];
  for (const segment of chapter.segments) {
    if (segment.kind === 'passage') {
      steps.push(...sentenceSteps(segment.paragraphs));
    } else if (segment.kind === 'branch') {
      const picked = choices[segment.on] ?? fallbacks[segment.on] ?? 0;
      steps.push(...sentenceSteps(segment.cases[picked] ?? []));
    } else if (segment.kind === 'choice') {
      steps.push({ kind: 'choice', choice: segment });
      const picked = choices[segment.id];
      if (picked === undefined || !segment.options[picked]) return steps;
      steps.push(...sentenceSteps(segment.options[picked].paragraphs));
    }
  }
  return steps;
}

export function transcript(steps, choices) {
  const paragraphs = [];
  for (const step of steps) {
    if (step.kind === 'sentence') {
      const last = paragraphs.at(-1);
      if (!step.startsParagraph && last?.kind === 'text') last.text += ` ${step.text}`;
      else paragraphs.push({ kind: 'text', text: step.text });
    } else {
      const picked = choices[step.choice.id];
      if (picked !== undefined && step.choice.options[picked]) paragraphs.push({ kind: 'choice', text: step.choice.options[picked].text });
    }
  }
  return paragraphs;
}

export class ChoiceEngine {
  constructor(options, mode) {
    this.candidates = options.map((text) => new TypingEngine(text, mode));
    this.alive = options.map(() => true);
  }

  get chosenIndex() {
    const index = this.candidates.findIndex((engine, position) => this.alive[position] && engine.isComplete);
    return index === -1 ? null : index;
  }

  get leading() {
    return this.candidates.find((engine, position) => this.alive[position]) ?? null;
  }

  input(character) {
    if (this.chosenIndex !== null) return 'ignored';
    const accepted = new Map();
    this.candidates.forEach((engine, index) => {
      if (!this.alive[index]) return;
      const attempt = Object.assign(Object.create(Object.getPrototypeOf(engine)), engine);
      const result = attempt.input(character);
      if (result === 'advanced' || result === 'partial') accepted.set(index, { attempt, result });
    });
    if (accepted.size === 0) return 'incorrect';
    this.candidates.forEach((engine, index) => {
      if (!this.alive[index]) return;
      if (accepted.has(index)) this.candidates[index] = accepted.get(index).attempt;
      else this.alive[index] = false;
    });
    return [...accepted.values()].some((item) => item.result === 'advanced') ? 'advanced' : 'partial';
  }
}

export class StorySession {
  constructor(story, progress, mode = 'tolerant') {
    const saved = { ...emptyProgress(), ...(progress ?? {}) };
    this.story = story;
    this.mode = mode;
    this.chapterIndex = Math.max(story.chapters.findIndex((chapter) => chapter.number === saved.chapterNumber), 0);
    this.choices = { ...saved.choices };
    this.results = [...saved.results];
    this.unlockedChapter = saved.unlockedChapter;
    this.discoveredOptions = structuredClone(saved.discoveredOptions);
    this.metrics = new TypingMetrics();
    this.phase = saved.isFinished ? 'finished' : 'typing';
    this.lastResult = null;
    this.steps = this.buildSteps();
    this.stepIndex = Math.min(saved.stepIndex, Math.max(this.steps.length - 1, 0));
    this.loadStep();
  }

  get chapter() {
    return this.story.chapters[this.chapterIndex];
  }

  get currentStep() {
    return this.steps[this.stepIndex] ?? null;
  }

  get completedSteps() {
    return this.steps.slice(0, this.stepIndex);
  }

  get current() {
    return this.sentenceEngine?.current ?? this.choiceEngine?.leading?.current ?? null;
  }

  get fractionCompleted() {
    return this.steps.length ? this.stepIndex / this.steps.length : 0;
  }

  get illustration() {
    for (const segment of this.chapter.segments) {
      if (segment.kind !== 'choice') continue;
      const image = segment.options[this.choices[segment.id]]?.image;
      if (image) return image;
    }
    return this.chapter.image ?? null;
  }

  get progress() {
    return {
      chapterNumber: this.chapter.number, stepIndex: this.stepIndex, choices: this.choices, results: this.results,
      isFinished: this.phase === 'finished', unlockedChapter: this.unlockedChapter, discoveredOptions: this.discoveredOptions,
    };
  }

  get fallbacks() {
    return Object.fromEntries(Object.entries(this.discoveredOptions).map(([id, options]) => [id, options.at(-1)]));
  }

  buildSteps() {
    return storySteps(this.chapter, this.choices, this.fallbacks);
  }

  receive(character, time) {
    if (this.phase !== 'typing') return 'ignored';
    const expected = this.current?.displayed;
    const engine = this.sentenceEngine ?? this.choiceEngine;
    const result = engine ? engine.input(character) : 'ignored';
    this.metrics.record(result, time, expected);
    this.completeStepIfNeeded();
    return result;
  }

  completeStepIfNeeded() {
    if (this.sentenceEngine?.isComplete) {
      this.advance();
      return;
    }
    const step = this.currentStep;
    const picked = this.choiceEngine?.chosenIndex;
    if (step?.kind !== 'choice' || picked === null || picked === undefined) return;
    this.choices[step.choice.id] = picked;
    const discovered = this.discoveredOptions[step.choice.id] ?? [];
    if (!discovered.includes(picked)) this.discoveredOptions[step.choice.id] = [...discovered, picked];
    this.steps = this.buildSteps();
    this.advance();
  }

  advance() {
    this.stepIndex += 1;
    if (this.stepIndex >= this.steps.length) this.finishChapter();
    else this.loadStep();
  }

  finishChapter() {
    const result = {
      chapterNumber: this.chapter.number,
      wordsPerMinute: this.metrics.finalWordsPerMinute,
      accuracy: this.metrics.accuracy,
      missedCharacters: this.metrics.mostMissedCharacters(MISSED_CHARACTER_COUNT),
    };
    this.results = [...this.results.filter((item) => item.chapterNumber !== result.chapterNumber), result];
    const following = this.story.chapters[this.chapterIndex + 1];
    if (following) this.unlockedChapter = Math.max(this.unlockedChapter, following.number);
    this.sentenceEngine = null;
    this.choiceEngine = null;
    this.lastResult = result;
    this.phase = 'chapterComplete';
  }

  get savedProgress() {
    if (this.phase !== 'chapterComplete') return this.progress;
    const following = this.story.chapters[this.chapterIndex + 1];
    return { ...this.progress, chapterNumber: following?.number ?? this.chapter.number, stepIndex: 0, isFinished: !following };
  }

  continueToNextChapter() {
    if (this.phase !== 'chapterComplete') return;
    if (!this.story.chapters[this.chapterIndex + 1]) {
      this.phase = 'finished';
      return;
    }
    this.chapterIndex += 1;
    this.stepIndex = 0;
    this.metrics = new TypingMetrics();
    this.steps = this.buildSteps();
    this.phase = 'typing';
    this.loadStep();
  }

  startChapter(number) {
    const index = this.story.chapters.findIndex((chapter) => chapter.number === number);
    if (index === -1 || number > this.unlockedChapter) return;
    this.chapterIndex = index;
    this.stepIndex = 0;
    this.metrics = new TypingMetrics();
    this.steps = this.buildSteps();
    this.phase = 'typing';
    this.loadStep();
  }

  loadStep() {
    const step = this.currentStep;
    this.sentenceEngine = step?.kind === 'sentence' ? new TypingEngine(step.text, this.mode) : null;
    this.choiceEngine = step?.kind === 'choice' ? new ChoiceEngine(step.choice.options.map((option) => option.text), this.mode) : null;
  }
}
