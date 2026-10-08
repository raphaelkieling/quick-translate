import path from 'node:path';
import { app, Menu, Tray, nativeImage } from 'electron';
import { loadSettings, saveSettings } from './store.js';
import { openSettings, sendToSettings, showLauncher } from './windows.js';

let tray;

// --- Menu bar icon ---

export function createTray() {
  // "Template" in the name makes macOS tint it for light/dark menu bars; drawn by build/make-icon.swift
  tray = new Tray(nativeImage.createFromPath(path.join(import.meta.dirname, 'assets', 'trayTemplate.png')));
  tray.setToolTip('QuickTranslate');
  updateTrayMenu();
}

// Rebuilt whenever the settings change, so the ✓ is on the second language in use.
export function updateTrayMenu() {
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

export function setSecondLanguage(secondLanguage) {
  saveSettings({ secondLanguage });
  updateTrayMenu();
  // Keep an open Settings window in sync, so saving it doesn't undo the change.
  sendToSettings('settings:second-language', secondLanguage);
}

// --- App menu ---

export function createAppMenu() {
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
