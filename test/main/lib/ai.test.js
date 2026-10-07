import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROVIDERS, buildRequest, hasApiKey } from '../../../src/main/lib/ai.js';

const settings = {
  provider: 'openai',
  openaiApiKey: 'sk-test',
  mainLanguage: 'Portuguese (Brazil)',
  secondLanguage: 'English',
};

describe('hasApiKey', () => {
  it('checks the key of the selected provider', () => {
    assert.equal(hasApiKey(settings), true);
    assert.equal(hasApiKey({ ...settings, provider: 'anthropic' }), false);
    assert.equal(hasApiKey({ ...settings, provider: 'anthropic', anthropicApiKey: 'key' }), true);
  });

  it('is false for an unknown provider', () => {
    assert.equal(hasApiKey({ provider: 'nope' }), false);
  });
});

describe('buildRequest', () => {
  it('rejects an unknown mode', () => {
    assert.throws(() => buildRequest('nope', 'hi', settings), /Unknown mode: nope/);
  });

  it('rejects an unknown provider', () => {
    assert.throws(() => buildRequest('translate', 'hi', { ...settings, provider: 'nope' }), /Unknown provider: nope/);
  });

  it('asks for the API key of the selected provider', () => {
    assert.throws(() => buildRequest('translate', 'hi', { ...settings, provider: 'google' }), /Add your Gemini API key/);
  });

  it('builds the prompt for the mode with the languages', () => {
    const request = buildRequest('explain', 'break a leg', settings);
    assert.equal(request.prompt, 'break a leg');
    assert.match(request.instructions, /native Portuguese \(Brazil\) speaker learning English/);
    assert.ok(request.model);
    assert.ok(request.output);
  });

  // Creating a model doesn't call the network, so this catches a broken provider setup.
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    it(`creates a model for ${provider.name}`, () => {
      const request = buildRequest('translate', 'oi', { ...settings, provider: id, [provider.keySetting]: 'key' });
      assert.ok(request.model);
      assert.equal(request.providerOptions, provider.providerOptions);
    });
  }
});
