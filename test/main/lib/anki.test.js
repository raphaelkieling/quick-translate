import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { addCards, addCardsForLanguage, getDecks, notesFor } from '../../../src/main/lib/anki.js';

// A fake AnkiConnect: `answers` maps an action to its `{ result, error }`.
function fakeAnki(answers) {
  const requests = [];
  mock.method(globalThis, 'fetch', async (_url, { body }) => {
    const request = JSON.parse(body);
    requests.push(request);
    return { json: async () => answers[request.action] ?? { result: null, error: null } };
  });
  return requests;
}

const FIELDS = { modelFieldNames: { result: ['Front', 'Back'], error: null } };

describe('anki', () => {
  beforeEach(() => mock.restoreAll());
  afterEach(() => mock.restoreAll());

  it('lists the decks', async () => {
    const requests = fakeAnki({ deckNames: { result: ['Default', 'English'], error: null } });
    assert.deepEqual(await getDecks(), ['Default', 'English']);
    assert.deepEqual(requests[0], { action: 'deckNames', version: 6, params: {} });
  });

  it('explains when Anki is not running', async () => {
    mock.method(globalThis, 'fetch', async () => {
      throw new TypeError('fetch failed');
    });
    await assert.rejects(getDecks(), /Anki is not running/);
  });

  it('passes on AnkiConnect errors', async () => {
    fakeAnki({ deckNames: { result: null, error: 'boom' } });
    await assert.rejects(getDecks(), /boom/);
  });

  const ALL = { basic: true, reversed: true, typeIn: true };
  const card = (front, back, cards = { basic: true, reversed: true }) => ({ front, back, cards });
  const notes = (requests) => requests.filter((r) => r.action === 'addNote').map((r) => r.params.note);

  describe('notesFor', () => {
    it('makes Basic and Reverse one note, so Anki keeps them apart', () => {
      assert.deepEqual(notesFor(card('oi', 'hi', ALL)), [
        { modelName: 'Basic (and reversed card)', fields: ['oi', 'hi'], audio: 1 },
        { modelName: 'Basic (type in the answer)', fields: ['oi', 'hi'], audio: 1 },
      ]);
    });

    it('makes a Basic note for Basic alone', () => {
      assert.deepEqual(notesFor(card('oi', 'hi', { basic: true })), [{ modelName: 'Basic', fields: ['oi', 'hi'], audio: 1 }]);
    });

    it('makes a Basic note the other way around for Reverse alone, with the audio on the front', () => {
      assert.deepEqual(notesFor(card('oi', 'hi', { reversed: true })), [{ modelName: 'Basic', fields: ['hi', 'oi'], audio: 0 }]);
    });

    it('uses the sides of the Type in card for its note', () => {
      const typeIn = { ...card('oi', 'hi **there**', { typeIn: true }), typeFront: 'hi ____ (oi)', typeBack: 'there' };
      assert.deepEqual(notesFor(typeIn), [
        { modelName: 'Basic (type in the answer)', fields: ['hi ____ (oi)', 'there'], audio: 1 },
      ]);
    });

    it('makes nothing when no card is picked', () => {
      assert.deepEqual(notesFor(card('oi', 'hi', {})), []);
    });
  });

  it('adds an escaped note to the deck, using the note type fields', async () => {
    const requests = fakeAnki(FIELDS);
    await addCards('English', card('a <b>', 'c & d'));

    const [note] = notes(requests);
    assert.equal(note.deckName, 'English');
    assert.equal(note.modelName, 'Basic (and reversed card)');
    assert.deepEqual(note.fields, { Front: 'a &lt;b&gt;', Back: 'c &amp; d' });
    assert.deepEqual(note.tags, ['quicktranslate']);
  });

  it('adds a note for each note type of the picked cards', async () => {
    const requests = fakeAnki(FIELDS);
    await addCards('English', card('oi', 'hi', ALL));
    assert.deepEqual(
      notes(requests).map((note) => note.modelName),
      ['Basic (and reversed card)', 'Basic (type in the answer)'],
    );
  });

  it('keeps **marked** words bold on the card', async () => {
    const requests = fakeAnki(FIELDS);
    await addCards('English', card('Eu **esbarrei** nele', 'I **ran into** him'));
    assert.deepEqual(notes(requests)[0].fields, { Front: 'Eu <b>esbarrei</b> nele', Back: 'I <b>ran into</b> him' });
  });

  it('attaches the audio to the field in the second language', async () => {
    const requests = fakeAnki(FIELDS);
    const audio = { filename: 'hi.m4a', data: 'AAAA' };
    await addCards('English', card('oi', 'hi', ALL), audio);
    assert.deepEqual(notes(requests)[0].audio, [{ ...audio, fields: ['Back'] }]);
    assert.deepEqual(notes(requests)[1].audio, [{ ...audio, fields: ['Back'] }]);

    const reversed = fakeAnki(FIELDS);
    await addCards('English', card('oi', 'hi', { reversed: true }), audio);
    assert.deepEqual(notes(reversed)[0].audio, [{ ...audio, fields: ['Front'] }]);
  });

  it('adds no audio when there is none', async () => {
    const requests = fakeAnki(FIELDS);
    await addCards('English', card('oi', 'hi'));
    assert.equal('audio' in notes(requests)[0], false);
  });

  it('refuses when no card is picked', async () => {
    const requests = fakeAnki(FIELDS);
    await assert.rejects(addCards('English', card('oi', 'hi', {})), /Pick at least one card/);
    assert.equal(requests.length, 0);
  });

  it('adds nothing when a note type is missing', async () => {
    const requests = [];
    mock.method(globalThis, 'fetch', async (_url, { body }) => {
      const request = JSON.parse(body);
      requests.push(request);
      const missing = request.params.modelName === 'Basic (type in the answer)';
      const answer = missing ? { result: null, error: 'model was not found' } : FIELDS.modelFieldNames;
      return { json: async () => answer };
    });
    await assert.rejects(addCards('English', card('a', 'b', ALL)), /no "Basic \(type in the answer\)" note type/);
    assert.equal(notes(requests).length, 0);
  });

  describe('addCardsForLanguage', () => {
    const settings = { ankiEnabled: true, ankiDecks: { English: 'English::Phrases' }, secondLanguage: 'English' };

    it('adds to the deck of the second language in use', async () => {
      const requests = fakeAnki(FIELDS);
      assert.equal(await addCardsForLanguage(settings, card('oi', 'hi')), 'English::Phrases');
      assert.equal(notes(requests)[0].deckName, 'English::Phrases');
    });

    it('refuses when Anki is off', async () => {
      const requests = fakeAnki(FIELDS);
      await assert.rejects(addCardsForLanguage({ ...settings, ankiEnabled: false }, card('a', 'b')), /Turn on Anki/);
      assert.equal(requests.length, 0);
    });

    it('refuses when the language has no deck', async () => {
      fakeAnki(FIELDS);
      await assert.rejects(
        addCardsForLanguage({ ...settings, secondLanguage: 'French' }, card('a', 'b')),
        /pick a deck for French/,
      );
    });
  });
});
