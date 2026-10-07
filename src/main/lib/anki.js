import { boldToHtml } from '../../shared/text.js';

// Talks to Anki through the AnkiConnect add-on: https://ankiweb.net/shared/info/2055492159
const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

// Creates a normal card (front -> back) and a reversed one (back -> front).
// Its fields are used in order: the first one is the front, the second one the back.
const NOTE_TYPE = 'Basic (and reversed card)';

async function invoke(action, params = {}) {
  let response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      body: JSON.stringify({ action, version: 6, params }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    throw new Error('Anki is not running, or the AnkiConnect add-on is not installed.');
  }
  const { result, error } = await response.json();
  if (error) throw new Error(error);
  return result;
}

export const getDecks = () => invoke('deckNames');

// Adds a note with a normal (front -> back) and a reversed (back -> front) card.
export async function addCard(deck, front, back) {
  const [frontField, backField] = await invoke('modelFieldNames', { modelName: NOTE_TYPE }).catch(() => {
    throw new Error(`Anki has no "${NOTE_TYPE}" note type.`);
  });
  await invoke('addNote', {
    note: {
      deckName: deck,
      modelName: NOTE_TYPE,
      fields: {
        [frontField]: boldToHtml(front),
        [backField]: boldToHtml(back),
      },
      tags: ['quicktranslate'],
    },
  });
}

// Each second language has its own deck. Returns the deck the card went to.
export async function addCardForLanguage({ ankiEnabled, ankiDecks, secondLanguage }, front, back) {
  const deck = ankiDecks[secondLanguage];
  if (!ankiEnabled || !deck) throw new Error(`Turn on Anki and pick a deck for ${secondLanguage} in Settings.`);
  await addCard(deck, front, back);
  return deck;
}
