import { boldToHtml, shortName } from '../../shared/text.js';

// What each mode looks like in the launcher. The prompts are in src/main/lib/prompts.js.
export const MODES = {
  translate: {
    label: 'Translate',
    from: (s) => s.mainLanguage,
    to: (s) => s.secondLanguage,
    description: (s) => `Write in ${s.mainLanguage}, get natural ways to say it in ${s.secondLanguage}`,
    placeholder: (s) => `What do you want to say? Write in ${s.mainLanguage}…`,
  },
  explain: {
    label: 'Explain',
    from: (s) => s.secondLanguage,
    to: (s) => s.mainLanguage,
    description: (s) => `Write a word or phrase in ${s.secondLanguage}, get what it means in ${s.mainLanguage}`,
    placeholder: (s) => `A word or phrase in ${s.secondLanguage}…`,
  },
};
export const MODE_IDS = Object.keys(MODES);

// "Portuguese → English"
export const direction = (id, settings) => `${shortName(MODES[id].from(settings))} → ${shortName(MODES[id].to(settings))}`;

// Both sides of the card, always main language -> second language (Anki also creates the reversed card).
// Translate: what you typed -> the phrase. Explain: the example's translation (its note) -> the example.
export const ankiCard = (answerMode, question, item) =>
  answerMode === 'translate' ? [question, item.text] : [item.note, item.text];

// Just enough Markdown for the summary: **bold**, *italic*, `code` and line breaks.
export const markdown = (text) =>
  boldToHtml(text)
    .replace(/(^|[^\w*])[*_](?!\s)(.+?)(?<!\s)[*_](?![\w*])/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

// The keyboard shortcuts shown at the bottom.
export function hint({ step, selected, canAddToAnki }) {
  if (step === 'pick') return '↑↓ choose   ↵ select   esc close';
  if (selected >= 0 && canAddToAnki) return '↑↓ select   ↵ copy   ⇧↵ add to Anki   esc close';
  if (selected >= 0) return '↑↓ select   ↵ copy   ⇥ switch mode   esc close';
  return '↵ ask   ⇥ switch mode   ⌫ modes   esc close';
}
