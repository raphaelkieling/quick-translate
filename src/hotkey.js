import uiohook from 'uiohook-napi';

const { uIOhook, UiohookKey } = uiohook;

const COMMAND_KEYS = [UiohookKey.Meta, UiohookKey.MetaRight];
const MAX_TAP_MS = 300; // holding Command longer than this is not a tap
const DOUBLE_TAP_MS = 400; // max time between the two taps

/**
 * Calls `callback` when Command is tapped twice in a row on its own.
 * Using Command as a modifier (⌘C, ⌘-click...) doesn't count.
 * Returns a function that stops listening.
 */
export function onDoubleCommand(callback) {
  let pressedAt = 0; // when Command went down, 0 while it is up
  let lastTapAt = 0;
  let interrupted = false; // another key or a click happened while Command was down

  const interrupt = () => {
    interrupted = true;
    lastTapAt = 0;
  };

  uIOhook.on('keydown', ({ keycode }) => {
    if (!COMMAND_KEYS.includes(keycode)) return interrupt();
    if (!pressedAt) {
      pressedAt = Date.now();
      interrupted = false;
    }
  });

  uIOhook.on('keyup', ({ keycode }) => {
    if (!COMMAND_KEYS.includes(keycode) || !pressedAt) return;
    const now = Date.now();
    const isTap = !interrupted && now - pressedAt < MAX_TAP_MS;
    pressedAt = 0;

    if (isTap && now - lastTapAt < DOUBLE_TAP_MS) {
      lastTapAt = 0;
      callback();
    } else {
      lastTapAt = isTap ? now : 0;
    }
  });

  uIOhook.on('mousedown', interrupt);
  uIOhook.start();
  return () => uIOhook.stop();
}
