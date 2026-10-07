import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { experimental_decide } from 'ai';
import { Experimental_DecisionMockModelV4 } from 'ai/test';
import {
  PROVIDERS,
  buildDecision,
  buildRequest,
  decisionKey,
  hasApiKey,
  readDecision,
  requestKey,
} from '../../../src/main/lib/ai.js';
import { OTHER_LANGUAGE } from '../../../src/main/lib/prompts.js';

const settings = {
  provider: 'openai',
  openaiApiKey: 'sk-test',
  mainLanguage: 'Portuguese (Brazil)',
  secondLanguage: 'English',
  secondLanguages: ['English'],
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
    const request = buildRequest('reverse', 'break a leg', settings);
    assert.equal(request.prompt, 'break a leg');
    assert.match(request.instructions, /native Portuguese \(Brazil\) speaker who is learning English/);
    assert.match(request.instructions, /wants to say it in Portuguese \(Brazil\)/);
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

describe('requestKey', () => {
  it('is the same for the same request', () => {
    assert.equal(requestKey('translate', 'oi', settings), requestKey('translate', 'oi', { ...settings }));
  });

  it('changes with the mode, the text, the languages and the provider', () => {
    const key = requestKey('translate', 'oi', settings);
    assert.notEqual(requestKey('reverse', 'oi', settings), key);
    assert.notEqual(requestKey('translate', 'olá', settings), key);
    assert.notEqual(requestKey('translate', 'oi', { ...settings, secondLanguage: 'French' }), key);
    assert.notEqual(requestKey('translate', 'oi', { ...settings, mainLanguage: 'Spanish' }), key);
    assert.notEqual(requestKey('translate', 'oi', { ...settings, provider: 'google' }), key);
  });

  it('ignores settings that do not change the answer', () => {
    assert.equal(requestKey('translate', 'oi', { ...settings, theme: 'dark' }), requestKey('translate', 'oi', settings));
  });
});

describe('decisionKey', () => {
  it('changes with the second languages, since they are the choices', () => {
    assert.notEqual(decisionKey('hi', { ...settings, secondLanguages: ['English', 'French'] }), decisionKey('hi', settings));
  });

  it('is not the key of a request', () => {
    assert.notEqual(decisionKey('oi', settings), requestKey('translate', 'oi', settings));
  });
});

describe('buildDecision', () => {
  it('asks for the API key of the selected provider', () => {
    assert.throws(() => buildDecision('hi', { ...settings, provider: 'anthropic' }), /Add your Claude API key/);
  });

  it('sends the text as the state', () => {
    const decision = buildDecision('break a leg', settings);
    assert.equal(decision.state, 'break a leg');
    assert.deepEqual(Object.keys(decision.questions), ['language']);
  });

  for (const [id, provider] of Object.entries(PROVIDERS)) {
    it(`creates a decision model for ${provider.name}`, () => {
      const { model } = buildDecision('oi', { ...settings, provider: id, [provider.keySetting]: 'key' });
      assert.equal(model.modelId, provider.decisionModel);
    });
  }
});

describe('readDecision', () => {
  const multilingual = { ...settings, secondLanguage: 'English', secondLanguages: ['English', 'Spanish'] };

  // A fake decision model that answers `language`, so the question goes through experimental_decide without a network.
  const decide = (language) =>
    experimental_decide({
      model: new Experimental_DecisionMockModelV4({
        doDecide: async () => ({ answers: { language: { type: 'choice', choice: language } }, warnings: [] }),
      }),
      state: 'hi',
      questions: buildDecision('hi', multilingual).questions,
    }).then((result) => readDecision(result.answers, multilingual));

  it('main language: translates to the second language in use', async () => {
    assert.deepEqual(await decide('Portuguese (Brazil)'), { mode: 'translate', language: 'English' });
  });

  it('a second language: translates it to the main language', async () => {
    assert.deepEqual(await decide('English'), { mode: 'reverse', language: 'English' });
    assert.deepEqual(await decide('Spanish'), { mode: 'reverse', language: 'Spanish' });
  });

  it('another language: keeps the mode you have', async () => {
    assert.equal(await decide(OTHER_LANGUAGE), null);
  });
});
