import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DOUBLE_TAP_MS, MAX_TAP_MS, createDoubleTapDetector } from '../../../src/main/lib/double-tap.js';

const CMD = 1;
const OTHER = 2;

describe('createDoubleTapDetector', () => {
  let time;
  let calls;
  let detector;

  // Presses and releases `key`, holding it for `ms`.
  const tap = (key = CMD, ms = 50) => {
    detector.keydown(key);
    time += ms;
    detector.keyup(key);
  };
  const wait = (ms) => {
    time += ms;
  };

  beforeEach(() => {
    time = 1_000;
    calls = 0;
    detector = createDoubleTapDetector([CMD], () => calls++, () => time);
  });

  it('fires on a double tap', () => {
    tap();
    wait(100);
    tap();
    assert.equal(calls, 1);
  });

  it('does not fire on a single tap', () => {
    tap();
    assert.equal(calls, 0);
  });

  it('does not fire when the taps are too far apart', () => {
    tap();
    wait(DOUBLE_TAP_MS);
    tap();
    assert.equal(calls, 0);
  });

  it('does not fire when the key is held too long', () => {
    tap(CMD, MAX_TAP_MS);
    wait(50);
    tap();
    assert.equal(calls, 0);
  });

  it('does not fire when used as a modifier (⌘C)', () => {
    detector.keydown(CMD);
    detector.keydown(OTHER);
    detector.keyup(OTHER);
    detector.keyup(CMD);
    wait(50);
    tap();
    assert.equal(calls, 0);
  });

  it('does not fire when used with a click (⌘-click)', () => {
    tap();
    wait(50);
    detector.keydown(CMD);
    detector.mousedown();
    detector.keyup(CMD);
    assert.equal(calls, 0);
  });

  it('does not fire when another key is pressed between the taps', () => {
    tap();
    tap(OTHER);
    tap();
    assert.equal(calls, 0);
  });

  it('ignores key repeat while the key is held', () => {
    detector.keydown(CMD);
    wait(20);
    detector.keydown(CMD); // auto-repeat must not restart the timer
    wait(MAX_TAP_MS);
    detector.keyup(CMD);
    tap();
    assert.equal(calls, 0);
  });

  it('needs two new taps after firing (a triple tap fires once)', () => {
    tap();
    tap();
    tap();
    assert.equal(calls, 1);
    tap();
    assert.equal(calls, 2);
  });
});
