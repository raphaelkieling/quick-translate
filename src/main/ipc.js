import { app, clipboard, ipcMain } from 'electron';
import { stripBold } from '../shared/text.js';
import { ask, decideMode, decisionKey, requestKey } from './lib/ai.js';
import { addCardForLanguage, getDecks } from './lib/anki.js';
import { recordSpeech } from './lib/audio.js';
import { setSecondLanguage, updateTrayMenu } from './menu.js';
import { cache, history, loadSettings, saveSettings } from './store.js';
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

// Reuses the answer to the same request when the cache is on (Settings). `cached` tells the launcher.
async function withCache(key, settings, run) {
  if (settings.cacheEnabled) {
    const value = cache.get(key);
    if (value !== undefined) return { value, cached: true };
  }
  const value = await run();
  if (settings.cacheEnabled) cache.set(key, value);
  return { value, cached: false };
}

// The launcher opens again in the mode and the second language you used last.
function remember(mode, language) {
  const { lastMode, secondLanguage } = loadSettings();
  if (mode !== lastMode) saveSettings({ lastMode: mode });
  if (language !== secondLanguage) setSecondLanguage(language);
}

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
    orError(async (_event, mode, text, language) => {
      const settings = settingsFor(language);
      remember(mode, settings.secondLanguage);
      const { value: output, cached } = await withCache(requestKey(mode, text, settings), settings, () =>
        ask(mode, text, settings),
      );
      history.add({ mode, language: settings.secondLanguage, text, output });
      return { output, cached };
    }),
  );
  ipcMain.handle(
    'ai:decide',
    orError(async (_event, text) => {
      const settings = loadSettings();
      const { value } = await withCache(decisionKey(text, settings), settings, () => decideMode(text, settings));
      return { decision: value };
    }),
  );

  ipcMain.handle('history:get', () => history.list());
  ipcMain.handle('history:clear', () => history.clear());
  ipcMain.handle('cache:size', () => cache.size());
  ipcMain.handle('cache:clear', () => cache.clear());

  ipcMain.handle('anki:decks', orError(async () => ({ decks: await getDecks() })));
  // The back is in the second language: the card plays it read by `voice`, the one the launcher uses.
  // Without a voice, or when recording fails, the card is added without audio (`audio` tells the launcher).
  ipcMain.handle(
    'anki:add',
    orError(async (_event, front, back, language, voice) => {
      const audio = voice ? await recordSpeech(stripBold(back), voice).catch(() => null) : null;
      return { deck: await addCardForLanguage(settingsFor(language), front, back, audio), audio: Boolean(audio) };
    }),
  );

  ipcMain.on('clipboard:write', (_event, text) => clipboard.writeText(text));
  ipcMain.on('launcher:hide', hideLauncher);
  ipcMain.on('launcher:resize', (_event, height) => resizeLauncher(height));
}
