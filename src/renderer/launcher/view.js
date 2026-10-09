import { boldToHtml, boldWords, hideBold, shortName } from '../../shared/text.js';

// What each mode looks like in the launcher. The prompts are in src/main/lib/prompts.js.
export const MODES = {
  translate: {
    label: 'Translate',
    from: (s) => s.mainLanguage,
    to: (s) => s.secondLanguage,
    placeholder: (s) => `What do you want to say? Write in ${s.mainLanguage}…`,
  },
  reverse: {
    label: 'Translate',
    from: (s) => s.secondLanguage,
    to: (s) => s.mainLanguage,
    placeholder: (s) => `Something in ${s.secondLanguage} to translate…`,
  },
  // The sentences are in the second language, their notes translate them.
  explore: {
    label: 'Explore',
    from: (s) => s.secondLanguage,
    to: (s) => s.secondLanguage,
    placeholder: (s) => `A word or an expression in ${s.secondLanguage} to explore…`,
  },
};
export const MODE_IDS = Object.keys(MODES);

// The launcher shows a row for each second language: the one in use first, then the others.
export const languages = ({ secondLanguage, secondLanguages = [] }) => [
  secondLanguage,
  ...secondLanguages.filter((language) => language !== secondLanguage),
];

// The settings as if `language` were the second language in use, for the modes above.
export const forLanguage = (settings, language) => ({ ...settings, secondLanguage: language });

// "Portuguese → English", or just "English" when the mode stays in one language.
export function direction(id, settings) {
  const [from, to] = [MODES[id].from(settings), MODES[id].to(settings)].map(shortName);
  return from === to ? from : `${from} → ${to}`;
}

// The badge in front of the text: the direction, with the mode name when the mode stays in one language.
export const badge = (id, settings) =>
  MODES[id].from(settings) === MODES[id].to(settings) ? `${MODES[id].label} ${direction(id, settings)}` : direction(id, settings);

// The answers are in the second language: they can be read aloud (there is no voice for the main language).
export const answersInSecondLanguage = (id, settings) => MODES[id].to(settings) === settings.secondLanguage;

// The text you type is in the second language: it can be read aloud too.
export const asksInSecondLanguage = (id, settings) => MODES[id].from(settings) === settings.secondLanguage;

// Both sides of the card, always main language -> second language (Anki also creates the reversed card).
// Translate: what you typed -> the phrase. The other way: the phrase -> what you typed.
// Explore: the translation -> the sentence.
export function ankiCard(answerMode, question, item) {
  if (answerMode === 'translate') return [question, item.text];
  if (answerMode === 'explore') return [item.note, item.text];
  return [item.text, question];
}

// The cards "Add to Anki" can create, all picked by default. How they become notes: src/main/lib/anki.js.
export function ankiCardTypes(settings) {
  const [main, second] = [settings.mainLanguage, settings.secondLanguage].map(shortName);
  return [
    { id: 'basic', label: 'Basic', direction: `${main} → ${second}` },
    { id: 'reversed', label: 'Reverse', direction: `${second} → ${main}` },
    { id: 'typeIn', label: 'Type in', direction: `${main} → ${second}` },
  ];
}

// The sides of the Type in card: the phrase with its **marked** words hidden (and the other side as a hint),
// and those words, the only thing to type. Without marked words, the whole phrase.
export function typeInCard(front, back) {
  const words = boldWords(back);
  if (words.length === 0) return [front, back];
  return [`${hideBold(back)} (${front})`, words.join(' ... ')];
}

// Just enough Markdown for the summary: **bold**, *italic*, `code` and line breaks.
export const markdown = (text) =>
  boldToHtml(text)
    .replace(/(^|[^\w*])[*_](?!\s)(.+?)(?<!\s)[*_](?![\w*])/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

// While the AI writes, a **mark** can still be open: hide it until it closes, so no stray * shows.
function hideOpenMark(text) {
  text = text.replace(/(?<!\*)\*$/, ''); // half of a ** still coming
  return (text.match(/\*\*/g)?.length ?? 0) % 2 ? text.replace(/\*\*(?![\s\S]*\*\*)/, '') : text;
}

// The answer while the AI writes it (see streamAnswer in src/main/lib/ai.js), ready to show.
// It isn't checked yet: fields can be missing, of another type, or cut in the middle.
export function partialAnswer(partial) {
  const text = (value) => (typeof value === 'string' ? hideOpenMark(value) : '');
  const items = Array.isArray(partial?.items) ? partial.items : [];
  return {
    summary: text(partial?.summary),
    items: items.map((item) => ({ text: text(item?.text), note: text(item?.note) })).filter((item) => item.text),
  };
}

// The line under each history entry: the first phrase, or the tip when there is none.
export const historyPreview = ({ output }) => output.items[0]?.text || output.summary.split('\n')[0];

// "now", "5 min ago", "3 h ago", "2 d ago"
export function timeAgo(at, now = Date.now()) {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

// The keyboard shortcuts shown at the bottom.
// `canSpeakText`: ⌘↵ reads the text you typed (when the answers can't be read aloud).
// `editing`: the arrows move the cursor in the text. `atTop`: on the first language, ↑ goes up to the text.
// `addingToAnki`: the "Add to Anki" form is open.
export function hint({ step, selected, inHistory, editing, atTop, addingToAnki, canAddToAnki, canSpeak, canSpeakText }) {
  if (addingToAnki) return '↵ add   ⇥ next   space toggle   esc cancel';
  if (step === 'pick' && inHistory) return '↑↓ select   ↵ open   esc close';
  if (step === 'pick' && editing) return '←→ move   ↓ modes   ⇥ mode   ↵ ask   esc close';
  if (step === 'pick' && atTop) return '↑ edit text   ↓ language   ←→ ⇥ mode   ↵ ask   esc close';
  if (step === 'pick') return '↑↓ language   ←→ ⇥ mode   ↵ ask   esc close';
  const listenToText = canSpeakText ? ['⌘↵ listen to text'] : [];
  if (selected < 0) return ['↵ ask', ...listenToText, '⇥ switch mode', '⌫ modes', 'esc close'].join('   ');
  const keys = ['↑↓ select', '↵ copy'];
  if (canAddToAnki) keys.push('⇧↵ add to Anki');
  if (canSpeak) keys.push('⌘↵ listen');
  keys.push(...listenToText);
  if (!canAddToAnki) keys.push('⇥ switch mode');
  return [...keys, 'esc close'].join('   ');
}
