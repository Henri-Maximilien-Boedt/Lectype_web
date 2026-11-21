const TOLERANT_ALTERNATIVES = {
  '’': ["'"], '‘': ["'"], '“': ['"'], '”': ['"'], '«': ['"'], '»': ['"'],
  '—': ['-'], '–': ['-'], '…': ['...'], 'œ': ['oe'], 'æ': ['ae'], '\n': [' '],
};

export const STANZA_BREAK = '\n\n';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function characters(text) {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

export function acceptedInputs(character, mode) {
  if (mode !== 'tolerant') return [character];
  return [character, ...(TOLERANT_ALTERNATIVES[character] ?? [])];
}

export function expectedCharacters(text, mode) {
  const result = [];
  for (const character of characters(text)) {
    const last = result[result.length - 1];
    if (character === '\n' && last && last.shown === '\n') {
      last.shown = STANZA_BREAK;
      continue;
    }
    result.push({ displayed: character, shown: character, accepted: acceptedInputs(character, mode) });
  }
  return result;
}
