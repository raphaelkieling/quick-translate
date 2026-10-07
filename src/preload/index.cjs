// The bridge between the windows (src/renderer) and the main process (src/main).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  openSettings: () => ipcRenderer.send('settings:open'),
  onSecondLanguage: (callback) => ipcRenderer.on('settings:second-language', (_event, language) => callback(language)),
  ask: (mode, text, language) => ipcRenderer.invoke('ai:ask', mode, text, language),
  decide: (text) => ipcRenderer.invoke('ai:decide', text),
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  getCacheSize: () => ipcRenderer.invoke('cache:size'),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  getAnkiDecks: () => ipcRenderer.invoke('anki:decks'),
  addToAnki: (front, back, language) => ipcRenderer.invoke('anki:add', front, back, language),
  copy: (text) => ipcRenderer.send('clipboard:write', text),
  hide: () => ipcRenderer.send('launcher:hide'),
  resize: (height) => ipcRenderer.send('launcher:resize', height),
  onShow: (callback) => ipcRenderer.on('launcher:show', (_event, settings, history) => callback(settings, history)),
});
