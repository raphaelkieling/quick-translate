import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MODE_IDS,
  ankiCard,
  answersInSecondLanguage,
  asksInSecondLanguage,
  badge,
  direction,
  forLanguage,
  hint,
  historyPreview,
  languages,
  markdown,
  timeAgo,
} from '../../src/renderer/launcher/view.js';
import { MODES as PROMPT_MODES } from '../../src/main/lib/prompts.js';

const settings = { mainLanguage: 'Portuguese (Brazil)', secondLanguage: 'English' };

describe('launcher modes', () => {
  it('has a prompt for every mode shown in the launcher', () => {
    assert.deepEqual(MODE_IDS.toSorted(), Object.keys(PROMPT_MODES).toSorted());
  });

  it('shows the direction with short language names', () => {
    assert.equal(direction('translate', settings), 'Portuguese → English');
    assert.equal(direction('reverse', settings), 'English → Portuguese');
    assert.equal(direction('explore', settings), 'English');
  });

  it('names the mode in the badge when it stays in one language', () => {
    assert.equal(badge('translate', settings), 'Portuguese → English');
    assert.equal(badge('explore', settings), 'Explore English');
  });

  it('reads aloud only the answers in the second language', () => {
    assert.equal(answersInSecondLanguage('translate', settings), true);
    assert.equal(answersInSecondLanguage('reverse', settings), false);
    assert.equal(answersInSecondLanguage('explore', settings), true);
  });

  it('knows when the text you type is in the second language', () => {
    assert.equal(asksInSecondLanguage('translate', settings), false);
    assert.equal(asksInSecondLanguage('reverse', settings), true);
    assert.equal(asksInSecondLanguage('explore', settings), true);
  });
});

describe('languages', () => {
  it('puts the second language in use first, then the others in order', () => {
    const settings = { secondLanguage: 'French', secondLanguages: ['English', 'French', 'Japanese'] };
    assert.deepEqual(languages(settings), ['French', 'English', 'Japanese']);
  });

  it('keeps the language in use even when it is not in the list', () => {
    assert.deepEqual(languages({ secondLanguage: 'German', secondLanguages: ['English'] }), ['German', 'English']);
    assert.deepEqual(languages({ secondLanguage: 'German' }), ['German']);
  });
});

describe('forLanguage', () => {
  it('shows the modes for another second language', () => {
    const french = forLanguage(settings, 'French');
    assert.equal(direction('translate', french), 'Portuguese → French');
    assert.equal(direction('reverse', french), 'French → Portuguese');
    assert.equal(settings.secondLanguage, 'English');
  });
});

describe('ankiCard', () => {
  const item = { text: 'Break a leg!', note: 'Boa sorte!' };

  it('translate: what you typed -> the phrase', () => {
    assert.deepEqual(ankiCard('translate', 'Boa sorte', item), ['Boa sorte', 'Break a leg!']);
  });

  it('the other way: the phrase -> what you typed', () => {
    assert.deepEqual(ankiCard('reverse', 'break a leg', { text: 'Boa sorte!', note: 'casual' }), ['Boa sorte!', 'break a leg']);
  });

  it('explore: the translation -> the sentence', () => {
    const sentence = { text: 'I **ran into** him.', note: 'Eu **esbarrei** nele.' };
    assert.deepEqual(ankiCard('explore', 'run into', sentence), ['Eu **esbarrei** nele.', 'I **ran into** him.']);
  });
});

describe('markdown', () => {
  it('formats bold, italic, code and line breaks', () => {
    assert.equal(markdown('**a** *b* _c_ `d`\ne'), '<b>a</b> <em>b</em> <em>c</em> <code>d</code><br>e');
  });

  it('escapes HTML before formatting', () => {
    assert.equal(markdown('<img src=x> **ok**'), '&lt;img src=x&gt; <b>ok</b>');
  });

  it('leaves snake_case and lone asterisks alone', () => {
    assert.equal(markdown('snake_case_name'), 'snake_case_name');
    assert.equal(markdown('2 * 3 * 4'), '2 * 3 * 4');
  });
});

describe('hint', () => {
  it('changes with the step, the selection and Anki', () => {
    assert.match(hint({ step: 'pick', selected: -1 }), /↑↓ language +←→ mode/);
    assert.match(hint({ step: 'ask', selected: -1 }), /ask/);
    assert.match(hint({ step: 'ask', selected: 0, canAddToAnki: false }), /copy .* switch mode/);
    assert.match(hint({ step: 'ask', selected: 0, canAddToAnki: true }), /add to Anki/);
    assert.match(hint({ step: 'ask', selected: 0, canSpeak: true }), /⌘↵ listen/);
    assert.doesNotMatch(hint({ step: 'ask', selected: 0, canSpeak: false }), /listen/);
    assert.match(hint({ step: 'ask', selected: 0, canSpeakText: true }), /⌘↵ listen to text/);
    assert.match(hint({ step: 'ask', selected: -1, canSpeakText: true }), /⌘↵ listen to text/);
    assert.match(hint({ step: 'pick', selected: -1, inHistory: true }), /↵ open/);
  });
});

describe('historyPreview', () => {
  const output = { summary: 'A wish of **good luck**.\nUsed in theater.', items: [{ text: 'Break a leg!', note: '' }] };

  it('shows the first phrase', () => {
    assert.equal(historyPreview({ mode: 'translate', output }), 'Break a leg!');
  });

  it('falls back to the first line of the tip when there are no phrases', () => {
    assert.equal(historyPreview({ mode: 'translate', output: { ...output, items: [] } }), 'A wish of **good luck**.');
  });
});

describe('timeAgo', () => {
  const now = Date.UTC(2026, 0, 10);
  const minute = 60_000;

  it('rounds down to minutes, hours or days', () => {
    assert.equal(timeAgo(now - 30_000, now), 'now');
    assert.equal(timeAgo(now - 5 * minute, now), '5 min ago');
    assert.equal(timeAgo(now - 3 * 60 * minute - 1, now), '3 h ago');
    assert.equal(timeAgo(now - 2 * 24 * 60 * minute, now), '2 d ago');
  });
});
