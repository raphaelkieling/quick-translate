import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { boldToHtml, escapeHtml, shortName, stripBold } from '../../src/shared/text.js';

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

describe('boldToHtml', () => {
  it('turns **marked** words into <b>', () => {
    assert.equal(boldToHtml('I **ran into** him'), 'I <b>ran into</b> him');
  });

  it('escapes HTML around and inside the marks', () => {
    assert.equal(boldToHtml('<i> **a & b**'), '&lt;i&gt; <b>a &amp; b</b>');
  });

  it('leaves text without marks alone', () => {
    assert.equal(boldToHtml('2 * 3'), '2 * 3');
  });
});

describe('stripBold', () => {
  it('removes the marks and keeps the words', () => {
    assert.equal(stripBold('I **ran into** him **yesterday**'), 'I ran into him yesterday');
  });
});
