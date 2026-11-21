import { expectedCharacters } from './typography.js';

export class TypingEngine {
  constructor(text, mode = 'tolerant') {
    this.expected = expectedCharacters(text, mode);
    this.index = 0;
    this.pendingInput = '';
    this.errorCount = 0;
  }

  get isComplete() {
    return this.index >= this.expected.length;
  }

  get current() {
    return this.isComplete ? null : this.expected[this.index];
  }

  get fractionCompleted() {
    return this.expected.length === 0 ? 1 : this.index / this.expected.length;
  }

  input(character) {
    const current = this.current;
    if (!current) return 'ignored';
    const candidate = this.pendingInput + character;
    if (current.accepted.includes(candidate)) {
      this.pendingInput = '';
      this.index += 1;
      return 'advanced';
    }
    if (current.accepted.some((accepted) => accepted.startsWith(candidate))) {
      this.pendingInput = candidate;
      return 'partial';
    }
    this.pendingInput = '';
    this.errorCount += 1;
    return 'incorrect';
  }
}
