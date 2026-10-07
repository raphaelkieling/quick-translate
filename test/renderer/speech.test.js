import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickVoice, voiceScore, voicesFor } from '../../src/renderer/speech.js';

// Like speechSynthesis.getVoices() on macOS.
const voice = (name, lang) => ({ name, lang, voiceURI: name });
const voices = [
  voice('Albert', 'en-US'),
  voice('Daniel', 'en-GB'),
  voice('Eddy (English (United States))', 'en-US'),
  voice('Joana', 'pt-PT'),
  voice('Kyoko', 'ja-JP'),
  voice('Luciana', 'pt-BR'),
  voice('Samantha', 'en-US'),
  voice('Sinji', 'yue-HK'),
  voice('Tingting', 'zh-CN'),
  voice('Broken', 'not a tag!'),
];
const names = (list) => list.map((v) => v.name);

describe('voiceScore', () => {
  it('fits the exact region best, then the most common region, then any region', () => {
    assert.equal(voiceScore(voice('Luciana', 'pt-BR'), 'Portuguese (Brazil)'), 3);
    assert.equal(voiceScore(voice('Samantha', 'en-US'), 'English'), 2);
    assert.equal(voiceScore(voice('Daniel', 'en-GB'), 'English'), 1);
    assert.equal(voiceScore(voice('Joana', 'pt-PT'), 'Portuguese (Brazil)'), 1);
  });

  it('is 0 for another language or a broken tag', () => {
    assert.equal(voiceScore(voice('Kyoko', 'ja-JP'), 'English'), 0);
    assert.equal(voiceScore(voice('Broken', 'not a tag!'), 'English'), 0);
  });
});

describe('voicesFor', () => {
  it('lists the voices of the language, best first and novelty voices last', () => {
    assert.deepEqual(names(voicesFor('English', voices)), ['Samantha', 'Daniel', 'Albert', 'Eddy (English (United States))']);
    assert.deepEqual(names(voicesFor('Portuguese (Portugal)', voices)), ['Joana', 'Luciana']);
    assert.deepEqual(names(voicesFor('Chinese (Simplified)', voices)), ['Tingting']);
  });

  it('is empty when no voice is installed for the language', () => {
    assert.deepEqual(voicesFor('Klingon', voices), []);
  });
});

describe('pickVoice', () => {
  it('uses the voice chosen in Settings', () => {
    assert.equal(pickVoice('English', voices, 'Daniel').name, 'Daniel');
  });

  it('falls back to the best voice when the chosen one is missing or for another language', () => {
    assert.equal(pickVoice('English', voices, 'Uninstalled').name, 'Samantha');
    assert.equal(pickVoice('English', voices, 'Kyoko').name, 'Samantha');
    assert.equal(pickVoice('English', voices, undefined).name, 'Samantha');
  });

  it('is undefined without a voice for the language', () => {
    assert.equal(pickVoice('Klingon', voices, undefined), undefined);
  });
});
