import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MODES, OTHER_LANGUAGE, answerSchema, languageQuestion } from '../../../src/main/lib/prompts.js';

const settings = { mainLanguage: 'Portuguese (Brazil)', secondLanguage: 'Japanese' };

describe('MODES', () => {
  for (const [id, mode] of Object.entries(MODES)) {
    it(`${id}: mentions both languages and sends the text as typed`, () => {
      const instructions = mode.instructions(settings);
      assert.match(instructions, /Portuguese \(Brazil\)/);
      assert.match(instructions, /Japanese/);
      assert.doesNotMatch(instructions, /undefined/);
      assert.equal(mode.prompt('  hello  ', settings), '  hello  ');
    });

    it(`${id}: asks to keep the **marked** words marked`, () => {
      assert.match(mode.instructions(settings), /\*\*double asterisks\*\*/);
    });
  }
});

describe('answerSchema', () => {
  it('accepts a summary with items', () => {
    const answer = { summary: '', items: [{ text: 'Hi', note: 'casual' }] };
    assert.deepEqual(answerSchema.parse(answer), answer);
  });

  it('rejects items without a note', () => {
    assert.equal(answerSchema.safeParse({ summary: '', items: [{ text: 'Hi' }] }).success, false);
  });
});

describe('languageQuestion', () => {
  it('chooses between the main language, the second languages and another one', () => {
    const { language } = languageQuestion({ ...settings, secondLanguages: ['English', 'Japanese'] });
    assert.equal(language.type, 'choice');
    assert.deepEqual(Object.keys(language.criteria), ['Portuguese (Brazil)', 'English', 'Japanese', OTHER_LANGUAGE]);
  });
});
