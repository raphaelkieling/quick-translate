import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULTS = {
  provider: 'openai', // 'openai', 'anthropic' or 'google' (see src/ai.js)
  openaiApiKey: '',
  anthropicApiKey: '',
  googleApiKey: '',
  defaultMode: 'translate', // 'translate' or 'explain'
  theme: 'system', // 'system', 'light' or 'dark'
  mainLanguage: 'Portuguese (Brazil)',
  secondLanguage: 'English',
  ankiEnabled: false, // create an Anki card for each translation
  ankiDeck: '',
};

// ~/Library/Application Support/quicktranslate/settings.json
// (a fixed folder, so `npm start` and the built app share the same settings)
const file = () => path.join(app.getPath('appData'), 'quicktranslate', 'settings.json');

export function loadSettings() {
  try {
    const { apiKey, ...saved } = JSON.parse(fs.readFileSync(file(), 'utf8'));
    // Older versions only supported OpenAI and saved its key as `apiKey`.
    return { ...DEFAULTS, openaiApiKey: apiKey ?? '', ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(changes) {
  const settings = { ...loadSettings(), ...changes };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  // 0o600: only your user can read it, since it holds the API keys.
  fs.writeFileSync(file(), JSON.stringify(settings, null, 2), { mode: 0o600 });
  return settings;
}
