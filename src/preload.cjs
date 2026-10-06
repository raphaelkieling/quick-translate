// The bridge between the windows (src/renderer) and the main process (src/main.js).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  openSettings: () => ipcRenderer.send('settings:open'),
  ask: (mode, text) => ipcRenderer.invoke('ai:ask', mode, text),
  getAnkiDecks: () => ipcRenderer.invoke('anki:decks'),
  addToAnki: (front, back) => ipcRenderer.invoke('anki:add', front, back),
  copy: (text) => ipcRenderer.send('clipboard:write', text),
  hide: () => ipcRenderer.send('launcher:hide'),
  resize: (height) => ipcRenderer.send('launcher:resize', height),
  onShow: (callback) => ipcRenderer.on('launcher:show', (_event, settings) => callback(settings)),
});
