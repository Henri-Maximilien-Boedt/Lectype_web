const fs = require('fs');
const path = require('path');

const SOURCE = process.env.LECTYPE_CONTENT_DIR || path.join(__dirname, '..', '..', 'Lectype', 'Content');
const TARGET = path.join(__dirname, '..', 'content');
const FOLDERS = ['Books', 'Covers', 'Stories'];
const SHARED_CASES = path.join(SOURCE, '..', 'Lectype', 'LectypeTests', 'typing-cases.json');
const CASES_TARGET = path.join(__dirname, '..', 'test', 'fixtures', 'typing-cases.json');

function copyFolder(name) {
  const from = path.join(SOURCE, name);
  const to = path.join(TARGET, name.toLowerCase());
  if (!fs.existsSync(from)) throw new Error(`Dossier introuvable : ${from}`);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, filter: (file) => !path.basename(file).startsWith('.') });
  return fs.readdirSync(to).length;
}

function buildIndex() {
  const books = fs.readdirSync(path.join(TARGET, 'books')).filter((file) => file.endsWith('.json')).map((file) => {
    const book = JSON.parse(fs.readFileSync(path.join(TARGET, 'books', file), 'utf8'));
    return {
      id: book.id, title: book.title, author: book.author, language: book.language, year: book.year ?? null,
      kind: book.kind ?? 'novel', cover: book.cover ?? null,
      chapterCount: book.chapters.length, pageCount: book.chapters.reduce((sum, chapter) => sum + chapter.pages.length, 0),
    };
  });
  const stories = fs.readdirSync(path.join(TARGET, 'stories')).filter((file) => file.endsWith('.json')).map((file) => {
    const story = JSON.parse(fs.readFileSync(path.join(TARGET, 'stories', file), 'utf8'));
    return {
      id: story.id, title: story.title, language: story.language, audience: story.audience, duration: story.duration,
      kind: story.kind ?? 'interactive', cover: story.cover ?? null, chapterCount: story.chapters.length,
    };
  });
  books.sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(path.join(TARGET, 'index.json'), JSON.stringify({ books, stories }, null, 2) + '\n');
  return { books: books.length, stories: stories.length };
}

const WORD_LIMIT = 4000;
const WORD_LENGTH = { min: 2, max: 9 };

function rankedWords(texts) {
  const counts = new Map();
  for (const text of texts) {
    for (const word of text.toLowerCase().split(/[^\p{L}]+/u)) {
      const length = [...word].length;
      if (length >= WORD_LENGTH.min && length <= WORD_LENGTH.max) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, WORD_LIMIT)
    .map(([word]) => word);
}

function buildWordBanks() {
  const textsByLanguage = new Map();
  for (const file of fs.readdirSync(path.join(TARGET, 'books')).filter((name) => name.endsWith('.json'))) {
    const book = JSON.parse(fs.readFileSync(path.join(TARGET, 'books', file), 'utf8'));
    const texts = textsByLanguage.get(book.language) ?? [];
    for (const chapter of book.chapters) texts.push(...chapter.pages.map((page) => page.text));
    textsByLanguage.set(book.language, texts);
  }
  const folder = path.join(TARGET, 'words');
  fs.mkdirSync(folder, { recursive: true });
  for (const [language, texts] of textsByLanguage) {
    fs.writeFileSync(path.join(folder, `${language}.json`), JSON.stringify(rankedWords(texts)) + '\n');
  }
  return [...textsByLanguage.keys()];
}

function main() {
  fs.mkdirSync(TARGET, { recursive: true });
  for (const name of FOLDERS) {
    console.log(`${name} : ${copyFolder(name)} éléments`);
  }
  fs.mkdirSync(path.dirname(CASES_TARGET), { recursive: true });
  fs.copyFileSync(SHARED_CASES, CASES_TARGET);
  console.log('Cas de test partagés copiés');
  const counts = buildIndex();
  console.log(`Index : ${counts.books} livres, ${counts.stories} histoires`);
  console.log(`Mots : ${buildWordBanks().join(', ')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { buildIndex, rankedWords };
