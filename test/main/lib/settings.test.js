import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { DEFAULTS, createSettingsStore, normalizeSettings } from '../../../src/main/lib/settings.js';

describe('normalizeSettings', () => {
  it('fills in the defaults', () => {
    assert.deepEqual(normalizeSettings({}), DEFAULTS);
  });

  it('keeps saved values', () => {
    const settings = normalizeSettings({ provider: 'google', secondLanguages: ['French'], secondLanguage: 'French' });
    assert.equal(settings.provider, 'google');
    assert.deepEqual(settings.secondLanguages, ['French']);
  });

  it('moves the old `apiKey` to `openaiApiKey`', () => {
    const settings = normalizeSettings({ apiKey: 'sk-old' });
    assert.equal(settings.openaiApiKey, 'sk-old');
    assert.equal('apiKey' in settings, false);
  });

  it('turns the old single second language into a list', () => {
    assert.deepEqual(normalizeSettings({ secondLanguage: 'German' }).secondLanguages, ['German']);
  });

  it('uses the old single deck for every language', () => {
    const settings = normalizeSettings({ secondLanguages: ['English', 'French'], ankiDeck: 'Phrases' });
    assert.deepEqual(settings.ankiDecks, { English: 'Phrases', French: 'Phrases' });
    assert.equal('ankiDeck' in settings, false);
  });

  it('ignores the old deck when there are decks per language', () => {
    const settings = normalizeSettings({ ankiDeck: 'Old', ankiDecks: { English: 'New' } });
    assert.deepEqual(settings.ankiDecks, { English: 'New' });
  });
});

describe('createSettingsStore', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quicktranslate-test-'));
    file = path.join(dir, 'nested', 'settings.json');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns the defaults when there is no file', () => {
    assert.deepEqual(createSettingsStore(file).load(), DEFAULTS);
  });

  it('returns the defaults when the file is broken', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ not json');
    assert.deepEqual(createSettingsStore(file).load(), DEFAULTS);
  });

  it('saves changes on top of the current settings', () => {
    const store = createSettingsStore(file);
    store.save({ provider: 'anthropic' });
    const saved = store.save({ theme: 'dark' });

    assert.equal(saved.provider, 'anthropic');
    assert.equal(saved.theme, 'dark');
    assert.deepEqual(store.load(), saved);
  });

  it('makes the file readable only by the user', { skip: process.platform === 'win32' }, () => {
    createSettingsStore(file).save({});
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  });
});
