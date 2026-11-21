export const INACTIVITY_THRESHOLD = 5;

export class TypingMetrics {
  constructor() {
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.correctCharacters = 0;
    this.activeDuration = 0;
    this.lastKeystrokeTime = null;
    this.missedCharacters = {};
    this.typedCharacters = {};
    this.timeline = { samples: [], errors: [] };
  }

  get accuracy() {
    return this.totalKeystrokes === 0 ? 1 : this.correctKeystrokes / this.totalKeystrokes;
  }

  get finalWordsPerMinute() {
    return this.lastKeystrokeTime === null ? 0 : this.wordsPerMinute(this.lastKeystrokeTime);
  }

  elapsed(time) {
    if (this.lastKeystrokeTime === null) return 0;
    return this.activeDuration + Math.min(Math.max(time - this.lastKeystrokeTime, 0), INACTIVITY_THRESHOLD);
  }

  wordsPerMinute(time) {
    const minutes = this.elapsed(time) / 60;
    return minutes > 0 ? this.correctCharacters / 5 / minutes : 0;
  }

  record(result, time, expected) {
    if (result === 'ignored') return;
    if (result === 'incorrect' && expected) {
      this.missedCharacters[expected] = (this.missedCharacters[expected] ?? 0) + 1;
    }
    this.activeDuration = this.elapsed(time);
    this.lastKeystrokeTime = time;
    this.totalKeystrokes += 1;
    if (result === 'incorrect') {
      this.timeline.errors.push(this.activeDuration);
    } else {
      this.correctKeystrokes += 1;
      if (result === 'advanced') {
        this.correctCharacters += 1;
        if (expected) this.typedCharacters[expected] = (this.typedCharacters[expected] ?? 0) + 1;
      }
    }
    while (this.timeline.samples.length + 1 <= this.activeDuration) {
      this.timeline.samples.push(this.wordsPerMinute(time));
    }
  }

  mostMissedCharacters(limit) {
    return Object.entries(this.missedCharacters)
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([character]) => character);
  }
}
