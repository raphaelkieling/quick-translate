import { shortName } from '../../shared/text.js';

// For a language without a deck yet: the first deck with the language in its name ("English::Phrases").
export function guessDeck(language, decks) {
  const name = shortName(language).toLowerCase();
  return decks.find((deck) => deck.toLowerCase().includes(name)) ?? '';
}
