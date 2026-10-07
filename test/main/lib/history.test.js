import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createHistory } from '../../../src/main/lib/history.js';

const output = { summary: 'ok', items: [] };
const entry = (text, mode = 'translate', language = 'English') => ({ mode, language, text, output });

describe('createHistory', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quicktranslate-test-'));
    file = path.join(dir, 'nested', 'history.json');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('is empty when there is no file or it is broken', () => {
    assert.deepEqual(createHistory(file).list(), []);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ not json');
    assert.deepEqual(createHistory(file).list(), []);
  });

  it('keeps the newest first, with the time it was asked', () => {
    const history = createHistory(file);
    history.add(entry('one'), 1);
    history.add(entry('two'), 2);
    assert.deepEqual(history.list(), [
      { ...entry('two'), at: 2 },
      { ...entry('one'), at: 1 },
    ]);
  });

  it('moves the same request to the top instead of repeating it', () => {
    const history = createHistory(file);
    history.add(entry('one'));
    history.add(entry('two'));
    history.add(entry('one'));
    assert.deepEqual(
      history.list().map((e) => e.text),
      ['one', 'two'],
    );
  });

  it('keeps the same text in another mode or language', () => {
    const history = createHistory(file);
    history.add(entry('hi'));
    history.add(entry('hi', 'explain'));
    history.add(entry('hi', 'translate', 'French'));
    assert.equal(history.list().length, 3);
  });

  it('keeps only the last `limit` entries', () => {
    const history = createHistory(file, 2);
    for (const text of ['one', 'two', 'three']) history.add(entry(text));
    assert.deepEqual(
      history.list().map((e) => e.text),
      ['three', 'two'],
    );
  });

  it('saves to the file and clears', () => {
    createHistory(file).add(entry('one'));
    const history = createHistory(file);
    assert.equal(history.list().length, 1);
    history.clear();
    assert.deepEqual(createHistory(file).list(), []);
  });

  it('makes the file readable only by the user', { skip: process.platform === 'win32' }, () => {
    createHistory(file).add(entry('one'));
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  });
});
