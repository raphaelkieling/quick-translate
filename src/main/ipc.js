import { app, clipboard, ipcMain } from 'electron';
import { ask, decideMode } from './lib/ai.js';
import { addCardForLanguage, getDecks } from './lib/anki.js';
import { updateTrayMenu } from './menu.js';
import { loadSettings, saveSettings } from './store.js';
import { applyTheme, hideLauncher, openSettings, resizeLauncher } from './windows.js';

// Errors are sent back as `{ error }`: the windows show the message.
const orError = (handler) => async (...args) => {
  try {
    return await handler(...args);
  } catch (error) {
    return { error: error.message };
  }
};

// The launcher can use any of the second languages, not only the one in use.
const settingsFor = (language) => {
  const settings = loadSettings();
  return settings.secondLanguages.includes(language) ? { ...settings, secondLanguage: language } : settings;
};

// Messages from the windows (see src/preload/index.cjs).
export function registerIpc() {
  // "Open at login" is stored by macOS, not in our settings file.
  // It only works in the built app: with `npm start` it would open a bare Electron.
  ipcMain.handle('settings:get', () => ({
    ...loadSettings(),
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    canOpenAtLogin: app.isPackaged,
  }));
  ipcMain.handle('settings:save', (_event, { openAtLogin, ...changes }) => {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin });
    const settings = saveSettings(changes);
    applyTheme(settings);
    updateTrayMenu();
    return settings;
  });
  ipcMain.on('settings:open', openSettings);

  ipcMain.handle(
    'ai:ask',
    orError(async (_event, mode, text, language) => ({ output: await ask(mode, text, settingsFor(language)) })),
  );
  ipcMain.handle('ai:decide', orError(async (_event, text) => ({ decision: await decideMode(text, loadSettings()) })));

  ipcMain.handle('anki:decks', orError(async () => ({ decks: await getDecks() })));
  ipcMain.handle(
    'anki:add',
    orError(async (_event, front, back, language) => ({
      deck: await addCardForLanguage(settingsFor(language), front, back),
    })),
  );

  ipcMain.on('clipboard:write', (_event, text) => clipboard.writeText(text));
  ipcMain.on('launcher:hide', hideLauncher);
  ipcMain.on('launcher:resize', (_event, height) => resizeLauncher(height));
}
