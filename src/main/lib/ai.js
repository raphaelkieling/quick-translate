import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { MODES, answerSchema } from './prompts.js';

// The AI providers you can pick in Settings. Change the model ids here.
// Small models are fast, which matters for a launcher.
export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    keySetting: 'openaiApiKey',
    model: (apiKey) => createOpenAI({ apiKey })('gpt-5.4-mini'),
    providerOptions: { openai: { reasoningEffort: 'low' } },
  },
  anthropic: {
    name: 'Claude',
    keySetting: 'anthropicApiKey',
    model: (apiKey) => createAnthropic({ apiKey })('claude-haiku-4-5'),
  },
  google: {
    name: 'Gemini',
    keySetting: 'googleApiKey',
    model: (apiKey) => createGoogle({ apiKey })('gemini-flash-latest'),
  },
};

export function hasApiKey(settings) {
  const provider = PROVIDERS[settings.provider];
  return Boolean(provider && settings[provider.keySetting]);
}

// Everything sent to the AI, checked first. Separate from `ask` so it can be tested without a network.
export function buildRequest(modeId, text, settings) {
  const mode = MODES[modeId];
  const provider = PROVIDERS[settings.provider];
  if (!mode) throw new Error(`Unknown mode: ${modeId}`);
  if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);
  if (!hasApiKey(settings)) throw new Error(`Add your ${provider.name} API key in Settings (⚙︎).`);

  return {
    model: provider.model(settings[provider.keySetting]),
    instructions: mode.instructions(settings),
    prompt: mode.prompt(text, settings),
    output: Output.object({ schema: answerSchema }),
    providerOptions: provider.providerOptions,
  };
}

export async function ask(modeId, text, settings) {
  const { output } = await generateText({
    ...buildRequest(modeId, text, settings),
    abortSignal: AbortSignal.timeout(30_000),
  });
  return output;
}
