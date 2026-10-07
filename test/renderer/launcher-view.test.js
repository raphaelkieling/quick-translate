import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MODE_IDS, ankiCard, direction, hint, markdown } from '../../src/renderer/launcher/view.js';
import { MODES as PROMPT_MODES } from '../../src/main/lib/prompts.js';

const settings = { mainLanguage: 'Portuguese (Brazil)', secondLanguage: 'English' };

describe('launcher modes', () => {
  it('has a prompt for every mode shown in the launcher', () => {
    assert.deepEqual(MODE_IDS.toSorted(), Object.keys(PROMPT_MODES).toSorted());
  });

  it('shows the direction with short language names', () => {
    assert.equal(direction('translate', settings), 'Portuguese → English');
    assert.equal(direction('explain', settings), 'English → Portuguese');
  });
});

describe('ankiCard', () => {
  const item = { text: 'Break a leg!', note: 'Boa sorte!' };

  it('translate: what you typed -> the phrase', () => {
    assert.deepEqual(ankiCard('translate', 'Boa sorte', item), ['Boa sorte', 'Break a leg!']);
  });

  it("explain: the example's translation -> the example", () => {
    assert.deepEqual(ankiCard('explain', 'break a leg', item), ['Boa sorte!', 'Break a leg!']);
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
    assert.match(hint({ step: 'pick', selected: -1 }), /choose/);
    assert.match(hint({ step: 'ask', selected: -1 }), /ask/);
    assert.match(hint({ step: 'ask', selected: 0, canAddToAnki: false }), /copy .* switch mode/);
    assert.match(hint({ step: 'ask', selected: 0, canAddToAnki: true }), /add to Anki/);
  });
});
