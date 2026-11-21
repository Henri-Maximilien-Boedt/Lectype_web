export function attachTypingInput(input, { onText, onDeadKey = () => {}, onKey = () => {} }) {
  input.addEventListener('input', (event) => {
    if (event.isComposing || event.inputType === 'insertCompositionText') return;
    const isLineBreak = event.inputType === 'insertLineBreak' || (event.inputType === 'insertText' && event.data === null);
    const text = isLineBreak ? '\n' : (event.data ?? input.value);
    input.value = '';
    if (text) onText(text);
  });
  input.addEventListener('compositionupdate', (event) => onDeadKey(event.data ?? ''));
  input.addEventListener('compositionend', (event) => {
    onDeadKey('');
    input.value = '';
    if (event.data) onText(event.data);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      onText('\n');
      return;
    }
    if (event.key === 'Tab') event.preventDefault();
    onKey(event);
  });
}
