export const MAX_TAP_MS = 300; // holding the key longer than this is not a tap
export const DOUBLE_TAP_MS = 400; // max time between the two taps

/**
 * Calls `callback` when one of `keys` is tapped twice in a row on its own.
 * Using it as a modifier (⌘C, ⌘-click...) doesn't count.
 * Feed it the keyboard and mouse events (see src/main/hotkey.js).
 * `now` is only replaced in tests.
 */
export function createDoubleTapDetector(keys, callback, now = Date.now) {
  let pressedAt = 0; // when the key went down, 0 while it is up
  let lastTapAt = 0;
  let interrupted = false; // another key or a click happened while the key was down

  const interrupt = () => {
    interrupted = true;
    lastTapAt = 0;
  };

  return {
    keydown(keycode) {
      if (!keys.includes(keycode)) return interrupt();
      if (!pressedAt) {
        pressedAt = now();
        interrupted = false;
      }
    },

    keyup(keycode) {
      if (!keys.includes(keycode) || !pressedAt) return;
      const time = now();
      const isTap = !interrupted && time - pressedAt < MAX_TAP_MS;
      pressedAt = 0;

      if (isTap && time - lastTapAt < DOUBLE_TAP_MS) {
        lastTapAt = 0;
        callback();
      } else {
        lastTapAt = isTap ? time : 0;
      }
    },

    mousedown: interrupt,
  };
}
