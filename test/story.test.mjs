import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storySteps, transcript, ChoiceEngine, StorySession } from '../public/js/core/story.js';

const story = {
  id: 'test',
  chapters: [
    { number: 1, title: 'One', image: 'one.jpg', segments: [
      { kind: 'passage', paragraphs: [['Ab.', 'Cd.'], ['Ef.']] },
      { kind: 'choice', id: 'chapter1', options: [
        { text: 'Oui.', paragraphs: [['Bien.']], image: 'yes.jpg' },
        { text: 'Non.', paragraphs: [['Dommage.']] },
      ] },
    ] },
    { number: 2, title: 'Two', segments: [
      { kind: 'branch', on: 'chapter1', cases: [[['Tu as dit oui.']], [['Tu as dit non.']]] },
    ] },
  ],
};

function type(session, text) {
  for (const character of text) session.receive(character, 1);
}

test('steps stop at an unanswered choice', () => {
  const steps = storySteps(story.chapters[0], {});
  assert.deepEqual(steps.map((step) => step.kind), ['sentence', 'sentence', 'sentence', 'choice']);
  assert.equal(steps[1].startsParagraph, false);
});

test('steps follow the chosen option and the branch', () => {
  assert.equal(storySteps(story.chapters[0], { chapter1: 1 }).at(-1).text, 'Dommage.');
  assert.equal(storySteps(story.chapters[1], { chapter1: 1 })[0].text, 'Tu as dit non.');
  assert.equal(storySteps(story.chapters[1], {}, { chapter1: 1 })[0].text, 'Tu as dit non.');
});

test('transcript joins sentences of a paragraph and shows choices', () => {
  const steps = storySteps(story.chapters[0], { chapter1: 0 });
  assert.deepEqual(transcript(steps, { chapter1: 0 }), [
    { kind: 'text', text: 'Ab. Cd.' }, { kind: 'text', text: 'Ef.' }, { kind: 'choice', text: 'Oui.' }, { kind: 'text', text: 'Bien.' },
  ]);
});

test('choice engine keeps the options matching what was typed', () => {
  const engine = new ChoiceEngine(['Non merci.', 'Nous y allons.'], 'tolerant');
  assert.equal(engine.input('N'), 'advanced');
  assert.equal(engine.input('o'), 'advanced');
  assert.equal(engine.input('x'), 'incorrect');
  assert.equal(engine.input('u'), 'advanced');
  assert.deepEqual(engine.alive, [false, true]);
  for (const character of 's y allons.') engine.input(character);
  assert.equal(engine.chosenIndex, 1);
});

test('a session plays a chapter, records the choice and moves to the branch', () => {
  const session = new StorySession(story, null);
  type(session, 'Ab.Cd.Ef.');
  assert.equal(session.currentStep.kind, 'choice');
  type(session, 'Non.');
  assert.deepEqual(session.choices, { chapter1: 1 });
  type(session, 'Dommage.');
  assert.equal(session.phase, 'chapterComplete');
  assert.equal(session.savedProgress.chapterNumber, 2);
  assert.equal(session.unlockedChapter, 2);
  session.continueToNextChapter();
  assert.equal(session.currentStep.text, 'Tu as dit non.');
  type(session, 'Tu as dit non.');
  session.continueToNextChapter();
  assert.equal(session.phase, 'finished');
});

test('the chosen option image replaces the chapter image', () => {
  const session = new StorySession(story, null);
  assert.equal(session.illustration, 'one.jpg');
  type(session, 'Ab.Cd.Ef.Oui.');
  assert.equal(session.illustration, 'yes.jpg');
});

test('a session resumes from saved progress', () => {
  const session = new StorySession(story, { chapterNumber: 1, stepIndex: 2, choices: {}, results: [], isFinished: false, unlockedChapter: 1, discoveredOptions: {} });
  assert.equal(session.currentStep.text, 'Ef.');
});
