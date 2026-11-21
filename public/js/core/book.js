export function positions(book) {
  return book.chapters.flatMap((chapter) => chapter.pages.map((page) => ({ chapter: chapter.number, page: page.number })));
}

export function ordinal(book, position) {
  const index = positions(book).findIndex((item) => item.chapter === position.chapter && item.page === position.page);
  return Math.max(index, 0);
}

export function pageAt(book, position) {
  const chapter = book.chapters.find((item) => item.number === position.chapter);
  return chapter?.pages.find((page) => page.number === position.page) ?? null;
}

export function chapterOf(book, position) {
  return book.chapters.find((item) => item.number === position.chapter) ?? null;
}

export function next(book, position) {
  const all = positions(book);
  return all[ordinal(book, position) + 1] ?? null;
}

export function previous(book, position) {
  const index = ordinal(book, position);
  return index > 0 ? positions(book)[index - 1] : null;
}

export function furthest(book, saved, reached) {
  if (!saved) return reached;
  return ordinal(book, reached) > ordinal(book, saved) ? reached : saved;
}

export function isCollection(book) {
  return (book.kind ?? 'novel') !== 'novel';
}
