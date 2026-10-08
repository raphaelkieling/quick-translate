import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { audioFilename, findVoice, parseVoices } from '../../../src/main/lib/audio.js';

// Like `say -v '?'` on macOS.
const SAY_OUTPUT = `Albert              en_US    # Hello! My name is Albert.
Bad News            en_US    # Hello! My name is Bad News.
Eddy (English (UK)) en_GB    # Hello! My name is Eddy.
Eddy (English (US)) en_US    # Hello! My name is Eddy.
Luciana             pt_BR    # Olá, o meu nome é Luciana.
Samantha            en_US    # Hello! My name is Samantha.
Tingting            zh_CN    # 你好，我叫婷婷。
`;
const voices = parseVoices(SAY_OUTPUT);

describe('parseVoices', () => {
  it('reads the name and the language of each voice', () => {
    assert.deepEqual(voices.slice(0, 4), [
      { name: 'Albert', lang: 'en-US' },
      { name: 'Bad News', lang: 'en-US' },
      { name: 'Eddy (English (UK))', lang: 'en-GB' },
      { name: 'Eddy (English (US))', lang: 'en-US' },
    ]);
    assert.equal(voices.length, 7);
  });
});

describe('findVoice', () => {
  it('finds the voice by its name', () => {
    assert.equal(findVoice(voices, { name: 'Samantha', lang: 'en-US' }).name, 'Samantha');
  });

  it('finds the voice when the launcher names it another way', () => {
    assert.equal(findVoice(voices, { name: 'Eddy (English (United States))', lang: 'en-US' }).name, 'Eddy (English (US))');
    assert.equal(findVoice(voices, { name: 'Eddy (English (United Kingdom))', lang: 'en-GB' }).name, 'Eddy (English (UK))');
  });

  it('is undefined for a voice `say` does not have', () => {
    assert.equal(findVoice(voices, { name: 'Kyoko', lang: 'ja-JP' }), undefined);
    assert.equal(findVoice(voices, { name: 'Eddy (Japanese (Japan))', lang: 'ja-JP' }), undefined);
  });
});

describe('audioFilename', () => {
  it('is the same for the same text and voice', () => {
    assert.equal(audioFilename('Break a leg!', 'Samantha'), audioFilename('Break a leg!', 'Samantha'));
    assert.match(audioFilename('Break a leg!', 'Samantha'), /^quicktranslate-[0-9a-f]{16}\.m4a$/);
  });

  it('changes with the text or the voice', () => {
    assert.notEqual(audioFilename('Break a leg!', 'Samantha'), audioFilename('Good luck!', 'Samantha'));
    assert.notEqual(audioFilename('Break a leg!', 'Samantha'), audioFilename('Break a leg!', 'Daniel'));
  });
});
