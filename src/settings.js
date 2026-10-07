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
  secondLanguages: ['English'], // the languages you are learning (pick them in Settings)
  secondLanguage: 'English', // the one in use (switch it from the menu bar icon)
  ankiEnabled: false, // create an Anki card for each translation
  ankiDecks: {}, // the deck of each second language: { English: 'English::Phrases' }
};

// ~/Library/Application Support/quicktranslate/settings.json
// (a fixed folder, so `npm start` and the built app share the same settings)
const file = () => path.join(app.getPath('appData'), 'quicktranslate', 'settings.json');

export function loadSettings() {
  try {
    const { apiKey, ankiDeck, ...saved } = JSON.parse(fs.readFileSync(file(), 'utf8'));
    // Older versions only supported OpenAI and saved its key as `apiKey`.
    const settings = { ...DEFAULTS, openaiApiKey: apiKey ?? '', ...saved };
    // Older versions had a single second language: keep it in the list.
    if (!saved.secondLanguages) settings.secondLanguages = [settings.secondLanguage];
    // Older versions had a single deck: use it for every language.
    if (!saved.ankiDecks && ankiDeck) {
      settings.ankiDecks = Object.fromEntries(settings.secondLanguages.map((language) => [language, ankiDeck]));
    }
    return settings;
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
