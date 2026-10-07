import { app, systemPreferences } from 'electron';
import { onDoubleCommand } from './hotkey.js';
import { registerIpc } from './ipc.js';
import { hasApiKey } from './lib/ai.js';
import { createAppMenu, createTray } from './menu.js';
import { loadSettings } from './store.js';
import { applyTheme, createLauncher, openSettings, showLauncher, toggleLauncher } from './windows.js';

let stopHotkey;

// --- Double ⌘ shortcut ---

function startHotkey() {
  // macOS only lets apps listen to the keyboard after Accessibility permission is granted.
  // Passing `true` shows the macOS prompt; we then wait until the permission is given.
  if (systemPreferences.isTrustedAccessibilityClient(true)) {
    stopHotkey = onDoubleCommand(toggleLauncher);
    return;
  }
  const timer = setInterval(() => {
    if (!systemPreferences.isTrustedAccessibilityClient(false)) return;
    clearInterval(timer);
    stopHotkey = onDoubleCommand(toggleLauncher);
  }, 2000);
}

// --- App start ---

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerIpc();
  app.on('second-instance', showLauncher);
  app.on('will-quit', () => stopHotkey?.());

  app.whenReady().then(async () => {
    app.dock?.hide();
    applyTheme(loadSettings());
    createAppMenu();
    createTray();
    await createLauncher();
    startHotkey();
    if (!hasApiKey(loadSettings())) openSettings();
  });
}
