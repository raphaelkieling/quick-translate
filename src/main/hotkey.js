import uiohook from 'uiohook-napi';
import { createDoubleTapDetector } from './lib/double-tap.js';

const { uIOhook, UiohookKey } = uiohook;

const COMMAND_KEYS = [UiohookKey.Meta, UiohookKey.MetaRight];

/**
 * Calls `callback` when Command is tapped twice in a row on its own.
 * Returns a function that stops listening.
 */
export function onDoubleCommand(callback) {
  const detector = createDoubleTapDetector(COMMAND_KEYS, callback);
  uIOhook.on('keydown', ({ keycode }) => detector.keydown(keycode));
  uIOhook.on('keyup', ({ keycode }) => detector.keyup(keycode));
  uIOhook.on('mousedown', () => detector.mousedown());
  uIOhook.start();
  return () => uIOhook.stop();
}
