import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeHtml, shortName } from '../../src/shared/text.js';

describe('escapeHtml', () => {
  it('escapes &, < and >', () => {
    assert.equal(escapeHtml('<b>Tom & Jerry</b>'), '&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });

  it('escapes & first, so entities are not escaped twice', () => {
    assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  });
});

describe('shortName', () => {
  it('removes the region in parentheses', () => {
    assert.equal(shortName('Portuguese (Brazil)'), 'Portuguese');
  });

  it('keeps names without parentheses', () => {
    assert.equal(shortName('English'), 'English');
  });

  it('handles a missing language', () => {
    assert.equal(shortName(), '');
  });
});
