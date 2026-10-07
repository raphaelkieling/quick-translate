import { app } from 'electron';
import path from 'node:path';
import { createCache } from './lib/cache.js';
import { createHistory } from './lib/history.js';
import { createSettingsStore } from './lib/settings.js';

// ~/Library/Application Support/quicktranslate/
// (a fixed folder, so `npm start` and the built app share the same files)
const folder = path.join(app.getPath('appData'), 'quicktranslate');
const store = createSettingsStore(path.join(folder, 'settings.json'));

export const loadSettings = store.load;
export const saveSettings = store.save;
export const history = createHistory(path.join(folder, 'history.json'));
export const cache = createCache(path.join(folder, 'cache.json'));
