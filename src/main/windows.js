import { app, BrowserWindow, nativeTheme, screen } from 'electron';
import path from 'node:path';
import { loadSettings } from './store.js';

const LAUNCHER_WIDTH = 640;
const preload = path.join(import.meta.dirname, '..', 'preload', 'index.cjs');
const page = (name) => path.join(import.meta.dirname, '..', 'renderer', name, 'index.html');

let launcher;
let settingsWindow;

// --- Launcher (the Spotlight-like window) ---

export function createLauncher() {
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

export function showLauncher() {
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

export function hideLauncher() {
  if (!launcher.isVisible()) return;
  launcher.hide();
  // Give the focus back to the app you were using.
  if (!settingsWindow) app.hide();
}

export function toggleLauncher() {
  if (launcher.isVisible()) hideLauncher();
  else showLauncher();
}

// The launcher grows and shrinks with its content.
export function resizeLauncher(height) {
  launcher.setSize(LAUNCHER_WIDTH, Math.ceil(height));
}

// --- Settings window ---

function showSettings() {
  app.show();
  settingsWindow.show();
  app.focus({ steal: true });
}

export function openSettings() {
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

// Sends a message to the Settings window, if it is open.
export function sendToSettings(channel, ...args) {
  settingsWindow?.webContents.send(channel, ...args);
}

// 'system', 'light' or 'dark'. Changes the colors of every window right away.
export function applyTheme(settings) {
  nativeTheme.themeSource = settings.theme;
}
