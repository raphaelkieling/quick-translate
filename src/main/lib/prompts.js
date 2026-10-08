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
 *
 * You can mark words like **this**. The AI marks the same words (or their translation)
 * in the answers: the launcher shows them in bold and Anki cards keep them bold.
 */

// Two modes translate, one each way. The notes and the tip are always in your main language.
const translation = (from, to) => ({
  instructions: (settings) => {
    const { mainLanguage, secondLanguage } = settings;
    const source = settings[from];
    const target = settings[to];
    return `
You help a native ${mainLanguage} speaker who is learning ${secondLanguage}.
The user writes something, usually in ${source} (it may be mixed with ${target}), and wants to say it in ${target}.

As items, give 5 different ways to say it in ${target}, from the closest to what they wrote to the most rewritten.
- The first items stay as close as possible to their words, structure and tone, so they still sound like themselves.
  Only fix what is wrong or would sound strange to a native speaker. Do not make it fancier, longer or more fluent than what they wrote.
- The next items can drift more: more natural and idiomatic, like a native speaker would say it in real life.
- Always keep the original meaning and intent. Never add or remove ideas.
- Mix casual and more formal options when that makes sense.
- Each note explains in a few words, in ${mainLanguage}, the tone or when to use it.

In the summary, give one short tip in ${mainLanguage} (for example, a common mistake to avoid or what an idiom really means).
Leave the summary empty if there is nothing useful to add.

They may mark words like **this** to show the part they care about.
Then, in every item, wrap the words that say it in **double asterisks**.
Only use **double asterisks** in the items when the user marked something.
`.trim();
  },
  prompt: (text) => text,
});

// You type a word in the second language and see it used in sentences, each with a simple translation.
const exploration = {
  instructions: ({ mainLanguage, secondLanguage }) =>
    `
You help a native ${mainLanguage} speaker who is learning ${secondLanguage}.
The user writes a word or an expression in ${secondLanguage} and wants to see how it is used.
If they write it in ${mainLanguage}, explore the most natural way to say it in ${secondLanguage}.

As items, give 6 example sentences in ${secondLanguage} that use it, from the most common use to the least common.
- Show its different meanings and uses, the expressions it is part of, and the words it often goes with.
- Short, natural sentences from real life, like a native speaker would say them.
- In every item, wrap the word or expression (as it appears in the sentence) in **double asterisks**.
- Each note is a simple, natural translation of the sentence to ${mainLanguage}, with the translation of the word wrapped in **double asterisks** too.

In the summary, explain in ${mainLanguage}, in one or two short sentences, what it means and when it is used.
`.trim(),
  prompt: (text) => text,
};

export const MODES = {
  // You type what you want to say in your main language and get natural ways to say it in the second one.
  translate: translation('mainLanguage', 'secondLanguage'),
  // The other way: you type in the second language and get natural ways to say it in your main language.
  reverse: translation('secondLanguage', 'mainLanguage'),
  // A word in the second language, used in example sentences.
  explore: exploration,
};

/**
 * Real Time Mode (turn it on in Settings): while you type, a quick decision finds the language
 * the text is written in, and that picks the mode (see readDecision in src/main/lib/ai.js):
 *   your main language -> translate to the second language in use
 *   a second language  -> translate it to your main language
 * Each key of `criteria` is an answer: the language names, or OTHER_LANGUAGE.
 */
export const OTHER_LANGUAGE = 'other';

export const languageQuestion = ({ mainLanguage, secondLanguages }) => ({
  language: {
    type: 'choice',
    instructions:
      'Which language is this text written in? Ignore typos, slang and missing accents. If it mixes languages, pick the one most of it is written in.',
    criteria: {
      ...Object.fromEntries([mainLanguage, ...secondLanguages].map((language) => [language, null])),
      [OTHER_LANGUAGE]: 'None of these languages',
    },
  },
});

/**
 * The shape of every answer. The launcher shows `summary` on top and lists
 * `items` below; selecting an item copies its `text`.
 * If you change this shape, update src/renderer/launcher/index.js too.
 */
export const answerSchema = z.object({
  summary: z.string().describe('Short paragraph shown above the list. Can be an empty string.'),
  items: z.array(
    z.object({
      text: z.string().describe('The sentence or phrase itself. This is what gets copied. Can have **marked** words.'),
      note: z.string().describe('Short note shown under the text. Can have **marked** words.'),
    }),
  ),
});
