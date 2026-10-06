import { app, BrowserWindow, Menu, Tray, clipboard, ipcMain, nativeImage, screen, systemPreferences } from 'electron';
import path from 'node:path';
import { ask, hasApiKey } from './ai.js';
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

function openSettings() {
  if (settingsWindow) return settingsWindow.focus();

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 700,
    useContentSize: true,
    title: 'Quick Language Settings',
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: { preload },
  });
  settingsWindow.loadFile(page('settings'));
  settingsWindow.once('ready-to-show', () => {
    app.show();
    settingsWindow.show();
    app.focus({ steal: true });
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// --- Menu bar icon and app menu ---

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('文A');
  tray.setToolTip('Quick Language');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open (⌘⌘)', click: showLauncher },
      { label: 'Settings…', click: openSettings },
      { type: 'separator' },
      { role: 'quit' },
    ]),
  );
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

// --- Messages from the windows (see src/preload.cjs) ---

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:save', (_event, settings) => saveSettings(settings));
ipcMain.on('settings:open', openSettings);
ipcMain.handle('ai:ask', async (_event, mode, text) => {
  try {
    return { output: await ask(mode, text, loadSettings()) };
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
    createAppMenu();
    createTray();
    await createLauncher();
    startHotkey();
    if (!hasApiKey(loadSettings())) openSettings();
  });
}
