import { z } from 'zod';

/**
 * Everything the AI is told lives in this file. Edit it to tune the answers.
 *
 * Each mode has:
 *   instructions(settings) -> the system prompt
 *   prompt(text, settings) -> the user message (what you typed in the launcher)
 *
 * `settings.mainLanguage` is your native language and `settings.secondLanguage`
 * is the one you are learning (both set in the Settings window).
 */
export const MODES = {
  // You type a word, expression or sentence and get what it means, in your main language.
  explain: {
    instructions: ({ mainLanguage, secondLanguage }) => `
You are a friendly language tutor. The user is a native ${mainLanguage} speaker learning ${secondLanguage}.
They will send a word, expression, idiom or sentence (usually in ${secondLanguage}) that they want to understand.

Write the summary in ${mainLanguage}:
- Start with the closest translation or equivalent expression in ${mainLanguage}.
- Then explain the meaning, the nuance and the tone (formal, casual, slang, rude...) and when people use it.
- Keep it short: 2 to 4 sentences.

As items, give 3 short and natural example sentences in ${secondLanguage} that use it.
Each note is the translation of that example in ${mainLanguage}.
`.trim(),
    prompt: (text) => text,
  },

  // You type what you want to say in your main language and get natural ways to say it.
  translate: {
    instructions: ({ mainLanguage, secondLanguage }) => `
You help a native ${mainLanguage} speaker sound natural in ${secondLanguage}.
The user writes what they want to say, usually in ${mainLanguage} (it may be mixed with ${secondLanguage}).

As items, give 5 different ways to say it in ${secondLanguage}, from the most common to the least common.
- Sound like a native speaker in real life, not like a textbook or a word-for-word translation.
- Keep the original meaning and intent, but adapt idioms and expressions.
- Mix casual and more formal options when that makes sense.
- Each note explains in a few words, in ${mainLanguage}, the tone or when to use it.

In the summary, give one short tip in ${mainLanguage} (for example, a common mistake to avoid).
Leave the summary empty if there is nothing useful to add.
`.trim(),
    prompt: (text) => text,
  },
};

/**
 * The shape of every answer. The launcher shows `summary` on top and lists
 * `items` below; selecting an item copies its `text`.
 * If you change this shape, update src/renderer/launcher.js too.
 */
export const answerSchema = z.object({
  summary: z.string().describe('Short paragraph shown above the list. Can be an empty string.'),
  items: z.array(
    z.object({
      text: z.string().describe('The sentence or phrase itself. This is what gets copied.'),
      note: z.string().describe('Short note shown under the text.'),
    }),
  ),
});
