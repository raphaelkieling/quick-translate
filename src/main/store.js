import { app } from 'electron';
import path from 'node:path';
import { createSettingsStore } from './lib/settings.js';

// ~/Library/Application Support/quicktranslate/settings.json
// (a fixed folder, so `npm start` and the built app share the same settings)
const store = createSettingsStore(path.join(app.getPath('appData'), 'quicktranslate', 'settings.json'));

export const loadSettings = store.load;
export const saveSettings = store.save;
