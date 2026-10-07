import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_decide, generateText, Output } from 'ai';
import { MODES, answerSchema, languageQuestion } from './prompts.js';

// The AI providers you can pick in Settings. Change the model ids here.
// Small models are fast, which matters for a launcher.
// `decisionModel` picks the mode while you type (Real Time Mode), so it is the fastest one.
export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    keySetting: 'openaiApiKey',
    create: (apiKey) => createOpenAI({ apiKey }),
    model: 'gpt-5.4-mini',
    decisionModel: 'gpt-5.4-nano',
    providerOptions: { openai: { reasoningEffort: 'low' } },
  },
  anthropic: {
    name: 'Claude',
    keySetting: 'anthropicApiKey',
    create: (apiKey) => createAnthropic({ apiKey }),
    model: 'claude-haiku-4-5',
    decisionModel: 'claude-haiku-4-5',
  },
  google: {
    name: 'Gemini',
    keySetting: 'googleApiKey',
    create: (apiKey) => createGoogle({ apiKey }),
    model: 'gemini-flash-latest',
    decisionModel: 'gemini-flash-lite-latest',
  },
};

export function hasApiKey(settings) {
  const provider = PROVIDERS[settings.provider];
  return Boolean(provider && settings[provider.keySetting]);
}

// The selected provider, set up with its API key.
function providerFor(settings) {
  const provider = PROVIDERS[settings.provider];
  if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);
  if (!hasApiKey(settings)) throw new Error(`Add your ${provider.name} API key in Settings (⚙︎).`);
  return { ...provider, client: provider.create(settings[provider.keySetting]) };
}

// Everything sent to the AI, checked first. Separate from `ask` so it can be tested without a network.
export function buildRequest(modeId, text, settings) {
  const mode = MODES[modeId];
  if (!mode) throw new Error(`Unknown mode: ${modeId}`);
  const provider = providerFor(settings);

  return {
    model: provider.client(provider.model),
    instructions: mode.instructions(settings),
    prompt: mode.prompt(text, settings),
    output: Output.object({ schema: answerSchema }),
    providerOptions: provider.providerOptions,
  };
}

// The same text asked the same way gets the same answer: the key of the request in the cache.
export const requestKey = (modeId, text, { provider, mainLanguage, secondLanguage }) =>
  JSON.stringify(['ask', provider, PROVIDERS[provider]?.model, modeId, mainLanguage, secondLanguage, text]);

export async function ask(modeId, text, settings) {
  const { output } = await generateText({
    ...buildRequest(modeId, text, settings),
    abortSignal: AbortSignal.timeout(30_000),
  });
  return output;
}

// The same for Real Time Mode: what the decision model gets to find the language of `text`.
export function buildDecision(text, settings) {
  const provider = providerFor(settings);
  return {
    model: provider.client.decisionModel(provider.decisionModel),
    state: text,
    questions: languageQuestion(settings),
  };
}

// The mode and the second language for the language of the text, or null for another language
// (then the launcher keeps the one you have).
export function readDecision(answers, { mainLanguage, secondLanguage, secondLanguages }) {
  const written = answers.language.choice;
  if (written === mainLanguage) return { mode: 'translate', language: secondLanguage };
  if (secondLanguages.includes(written)) return { mode: 'explain', language: written };
  return null;
}

// The same for Real Time Mode. The decision also depends on the second languages (see readDecision).
export const decisionKey = (text, { provider, mainLanguage, secondLanguage, secondLanguages }) =>
  JSON.stringify(['decide', provider, PROVIDERS[provider]?.decisionModel, mainLanguage, secondLanguage, secondLanguages, text]);

export async function decideMode(text, settings) {
  const { answers } = await experimental_decide({
    ...buildDecision(text, settings),
    maxRetries: 0, // you keep typing: the next decision comes soon anyway
    abortSignal: AbortSignal.timeout(10_000),
  });
  return readDecision(answers, settings);
}
