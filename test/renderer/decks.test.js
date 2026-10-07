import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guessDeck } from '../../src/renderer/settings/decks.js';

const decks = ['Default', 'English::Phrases', 'portuguese vocab'];

describe('guessDeck', () => {
  it('picks the first deck with the language in its name', () => {
    assert.equal(guessDeck('English', decks), 'English::Phrases');
  });

  it('ignores case and the region', () => {
    assert.equal(guessDeck('Portuguese (Brazil)', decks), 'portuguese vocab');
  });

  it('returns an empty string when nothing matches', () => {
    assert.equal(guessDeck('French', decks), '');
    assert.equal(guessDeck('English', []), '');
  });
});
