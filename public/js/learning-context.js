import { settings, read, write } from './storage.js';
import { loadLayout } from './keyboard.js';
import { lessonsFor, reviewLesson, REVIEW_LESSON_ID, WORD_LANGUAGES } from './core/learning.js';

export function wordLanguage() {
  const preferred = settings.get().wordLanguage;
  if (WORD_LANGUAGES.includes(preferred)) return preferred;
  const page = document.documentElement.lang;
  return WORD_LANGUAGES.includes(page) ? page : 'en';
}

export async function learningContext() {
  const layout = await loadLayout(settings.get().keyboardLayout);
  const language = wordLanguage();
  const lessons = lessonsFor(layout, language);
  const progressKey = `learning.${layout.name}`;
  return {
    layout, language, lessons,
    progress: () => read(progressKey, { records: {} }),
    saveProgress: (progress) => write(progressKey, progress),
    lesson(id, progress) {
      return id === REVIEW_LESSON_ID ? reviewLesson(progress, lessons) : lessons.find((lesson) => lesson.id === id) ?? null;
    },
    after(lesson) {
      const index = lessons.findIndex((item) => item.id === lesson.id);
      return index >= 0 ? lessons[index + 1] ?? null : null;
    },
  };
}
