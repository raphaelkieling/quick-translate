import { boldToHtml } from '../../shared/text.js';

// Talks to Anki through the AnkiConnect add-on: https://ankiweb.net/shared/info/2055492159
const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

// The note types used for the cards you pick in the launcher. Their fields are used in order:
// the first one is the front, the second one the back.
const BASIC = 'Basic';
const BASIC_AND_REVERSED = 'Basic (and reversed card)';
const TYPE_IN = 'Basic (type in the answer)';

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

// The notes for the cards you picked (see ankiCardTypes in src/renderer/launcher/view.js).
// `front` is in the main language, `back` in the second language: `audio` is the index of the field that has it.
// Basic and Reverse together are one note, so Anki doesn't show both on the same day. Reverse alone is a Basic note
// the other way around. Type in has its own sides (`typeFront`, `typeBack`): the phrase with the words to type hidden.
export function notesFor({ front, back, typeFront = front, typeBack = back, cards: { basic, reversed, typeIn } }) {
  const notes = [];
  if (basic && reversed) notes.push({ modelName: BASIC_AND_REVERSED, fields: [front, back], audio: 1 });
  else if (basic) notes.push({ modelName: BASIC, fields: [front, back], audio: 1 });
  else if (reversed) notes.push({ modelName: BASIC, fields: [back, front], audio: 0 });
  if (typeIn) notes.push({ modelName: TYPE_IN, fields: [typeFront, typeBack], audio: 1 });
  return notes;
}

// Adds the notes for the cards you picked. `audio` ({ filename, data } in base64, see src/main/lib/audio.js)
// is the phrase in the second language, played with it.
export async function addCards(deck, card, audio) {
  const notes = notesFor(card);
  if (notes.length === 0) throw new Error('Pick at least one card.');
  // Look up every note type first, so a missing one adds nothing.
  const fieldNames = await Promise.all(
    notes.map(({ modelName }) =>
      invoke('modelFieldNames', { modelName }).catch(() => {
        throw new Error(`Anki has no "${modelName}" note type.`);
      }),
    ),
  );
  for (const [i, note] of notes.entries()) {
    const names = fieldNames[i];
    await invoke('addNote', {
      note: {
        deckName: deck,
        modelName: note.modelName,
        fields: { [names[0]]: boldToHtml(note.fields[0]), [names[1]]: boldToHtml(note.fields[1]) },
        tags: ['quicktranslate'],
        ...(audio && { audio: [{ ...audio, fields: [names[note.audio]] }] }),
      },
    });
  }
}

// Each second language has its own deck. Returns the deck the cards went to.
export async function addCardsForLanguage({ ankiEnabled, ankiDecks, secondLanguage }, card, audio) {
  const deck = ankiDecks[secondLanguage];
  if (!ankiEnabled || !deck) throw new Error(`Turn on Anki and pick a deck for ${secondLanguage} in Settings.`);
  await addCards(deck, card, audio);
  return deck;
}
