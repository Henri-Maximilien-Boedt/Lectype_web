export const MINIMUM_CORRECT_CHARACTERS = 20;

export function makeSession({ activity, itemID, title, metrics, endedAt = new Date() }) {
  if (metrics.correctCharacters < MINIMUM_CORRECT_CHARACTERS) return null;
  return {
    id: globalThis.crypto.randomUUID(),
    activity, itemID, title,
    startedAt: new Date(endedAt.getTime() - metrics.activeDuration * 1000).toISOString(),
    activeDuration: metrics.activeDuration,
    correctCharacters: metrics.correctCharacters,
    totalKeystrokes: metrics.totalKeystrokes,
    correctKeystrokes: metrics.correctKeystrokes,
    details: { missedCharacters: metrics.missedCharacters, typedCharacters: metrics.typedCharacters, timeline: metrics.timeline },
  };
}
