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
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { buildIndex };
