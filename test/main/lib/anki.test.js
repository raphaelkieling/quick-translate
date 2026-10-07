import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { addCard, addCardForLanguage, getDecks } from '../../../src/main/lib/anki.js';

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

  it('adds an escaped note to the deck, using the note type fields', async () => {
    const requests = fakeAnki(FIELDS);
    await addCard('English', 'a <b>', 'c & d');

    const { note } = requests.find((r) => r.action === 'addNote').params;
    assert.equal(note.deckName, 'English');
    assert.equal(note.modelName, 'Basic (and reversed card)');
    assert.deepEqual(note.fields, { Front: 'a &lt;b&gt;', Back: 'c &amp; d' });
    assert.deepEqual(note.tags, ['quicktranslate']);
  });

  it('explains when the note type is missing', async () => {
    fakeAnki({ modelFieldNames: { result: null, error: 'model was not found' } });
    await assert.rejects(addCard('English', 'a', 'b'), /no "Basic \(and reversed card\)" note type/);
  });

  describe('addCardForLanguage', () => {
    const settings = { ankiEnabled: true, ankiDecks: { English: 'English::Phrases' }, secondLanguage: 'English' };

    it('adds to the deck of the second language in use', async () => {
      const requests = fakeAnki(FIELDS);
      assert.equal(await addCardForLanguage(settings, 'oi', 'hi'), 'English::Phrases');
      assert.equal(requests.find((r) => r.action === 'addNote').params.note.deckName, 'English::Phrases');
    });

    it('refuses when Anki is off', async () => {
      const requests = fakeAnki(FIELDS);
      await assert.rejects(addCardForLanguage({ ...settings, ankiEnabled: false }, 'a', 'b'), /Turn on Anki/);
      assert.equal(requests.length, 0);
    });

    it('refuses when the language has no deck', async () => {
      fakeAnki(FIELDS);
      await assert.rejects(addCardForLanguage({ ...settings, secondLanguage: 'French' }, 'a', 'b'), /pick a deck for French/);
    });
  });
});
