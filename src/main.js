import { app, BrowserWindow, Menu, Tray, clipboard, ipcMain, nativeImage, nativeTheme, screen, systemPreferences } from 'electron';
import path from 'node:path';
import { ask, hasApiKey } from './ai.js';
import { addCard, getDecks } from './anki.js';
import { onDoubleCommand } from './hotkey.js';
import { loadSettings, saveSettings } from './settings.js';

const LAUNCHER_WIDTH = 640;
const preload = path.join(import.meta.dirname, 'preload.cjs');
const page = (name) => path.join(import.meta.dirname, 'renderer', `${name}.html`);

let launcher;
let settingsWindow;
let tray;
let stopHotkey;

// --- Launcher (the Spotlight-like window) ---

function createLauncher() {
  launcher = new BrowserWindow({
    width: LAUNCHER_WIDTH,
    height: 60,
    show: false,
    frame: false,
    roundedCorners: false, // sharp corners, like the rest of the design
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    webPreferences: { preload },
  });
  launcher.setAlwaysOnTop(true, 'floating');
  launcher.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  launcher.on('blur', hideLauncher);
  return launcher.loadFile(page('launcher'));
}

function showLauncher() {
  // Open on the screen where the mouse is, like Spotlight.
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  launcher.setPosition(
    Math.round(workArea.x + (workArea.width - LAUNCHER_WIDTH) / 2),
    Math.round(workArea.y + workArea.height * 0.2),
  );
  launcher.webContents.send('launcher:show', loadSettings());
  app.show();
  launcher.show();
  app.focus({ steal: true });
}

function hideLauncher() {
  if (!launcher.isVisible()) return;
  launcher.hide();
  // Give the focus back to the app you were using.
  if (!settingsWindow) app.hide();
}

function toggleLauncher() {
  if (launcher.isVisible()) hideLauncher();
  else showLauncher();
}

// --- Settings window ---

function showSettings() {
  app.show();
  settingsWindow.show();
  app.focus({ steal: true });
}

function openSettings() {
  if (settingsWindow) return showSettings();

  settingsWindow = new BrowserWindow({
    width: 760,
    height: 600,
    useContentSize: true,
    title: 'QuickTranslate Settings',
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f0f11' : '#f7f6f1',
    webPreferences: { preload },
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  // Show once the page has loaded. ('ready-to-show' never fires when the app starts in the background.)
  settingsWindow.loadFile(page('settings')).then(showSettings);
}

// --- Menu bar icon and app menu ---

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('文A');
  tray.setToolTip('QuickTranslate');
  updateTrayMenu();
}

// Rebuilt whenever the settings change, so the ✓ is on the second language in use.
function updateTrayMenu() {
  const { secondLanguages, secondLanguage } = loadSettings();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open (⌘⌘)', click: showLauncher },
      { label: 'Settings…', click: openSettings },
      { type: 'separator' },
      { label: 'Second language', enabled: false },
      ...secondLanguages.map((language) => ({
        label: language,
        type: 'radio',
        checked: language === secondLanguage,
        click: () => setSecondLanguage(language),
      })),
      { type: 'separator' },
      { role: 'quit' },
    ]),
  );
}

function setSecondLanguage(secondLanguage) {
  saveSettings({ secondLanguage });
  updateTrayMenu();
  // Keep an open Settings window in sync, so saving it doesn't undo the change.
  settingsWindow?.webContents.send('settings:second-language', secondLanguage);
}

function createAppMenu() {
  // Not visible (no Dock icon), but it makes ⌘, and copy/paste shortcuts work.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [{ label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings }, { type: 'separator' }, { role: 'quit' }],
      },
      { role: 'editMenu' },
    ]),
  );
}

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

// 'system', 'light' or 'dark'. Changes the colors of every window right away.
function applyTheme(settings) {
  nativeTheme.themeSource = settings.theme;
}

// --- Messages from the windows (see src/preload.cjs) ---

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
ipcMain.handle('ai:ask', async (_event, mode, text) => {
  try {
    return { output: await ask(mode, text, loadSettings()) };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle('anki:decks', async () => {
  try {
    return { decks: await getDecks() };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle('anki:add', async (_event, front, back) => {
  const { ankiEnabled, ankiDeck } = loadSettings();
  if (!ankiEnabled || !ankiDeck) return { error: 'Turn on Anki and pick a deck in Settings.' };
  try {
    await addCard(ankiDeck, front, back);
    return { deck: ankiDeck };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.on('clipboard:write', (_event, text) => clipboard.writeText(text));
ipcMain.on('launcher:hide', hideLauncher);
ipcMain.on('launcher:resize', (_event, height) => launcher.setSize(LAUNCHER_WIDTH, Math.ceil(height)));

// --- App start ---

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
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
