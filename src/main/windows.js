import { app, BrowserWindow, nativeTheme, screen } from 'electron';
import path from 'node:path';
import { history, loadSettings } from './store.js';

const LAUNCHER_WIDTH = 640;
const preload = path.join(import.meta.dirname, '..', 'preload', 'index.cjs');
const page = (name) => path.join(import.meta.dirname, '..', 'renderer', name, 'index.html');

let launcher;
let settingsWindow;

// Same as --bg in style.css. Painted before the page, so there is no flash when a window opens.
const backgroundColor = () => (nativeTheme.shouldUseDarkColors ? '#0f0f11' : '#f7f6f1');

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
    backgroundColor: backgroundColor(),
    // Keep rendering while hidden, so the launcher shows up instantly.
    webPreferences: { preload, backgroundThrottling: false },
  });
  nativeTheme.on('updated', () => launcher.setBackgroundColor(backgroundColor()));
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
  launcher.webContents.send('launcher:show', loadSettings(), history.list());
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
  height = Math.ceil(height);
  if (launcher.getSize()[1] === height) return;
  launcher.setSize(LAUNCHER_WIDTH, height);
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
    height: 640,
    useContentSize: true,
    title: 'QuickTranslate Settings',
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: backgroundColor(),
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
