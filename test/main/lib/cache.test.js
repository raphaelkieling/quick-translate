import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createCache } from '../../../src/main/lib/cache.js';

describe('createCache', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quicktranslate-test-'));
    file = path.join(dir, 'nested', 'cache.json');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns undefined for what is not cached, even null for what is', () => {
    const cache = createCache(file);
    assert.equal(cache.get('a'), undefined);
    cache.set('a', null);
    assert.equal(cache.get('a'), null);
  });

  it('is empty when the file is broken', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ not json');
    assert.equal(createCache(file).size(), 0);
  });

  it('saves to the file', () => {
    createCache(file).set('a', { summary: 'ok' });
    const cache = createCache(file);
    assert.deepEqual(cache.get('a'), { summary: 'ok' });
    assert.equal(cache.size(), 1);
  });

  it('drops the least recently used once over the limit', () => {
    const cache = createCache(file, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // used again: b is now the oldest
    cache.set('c', 3);
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('c'), 3);
  });

  it('clears', () => {
    const cache = createCache(file);
    cache.set('a', 1);
    cache.clear();
    assert.equal(cache.size(), 0);
    assert.equal(createCache(file).size(), 0);
  });
});
