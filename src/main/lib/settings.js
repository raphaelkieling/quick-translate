import fs from 'node:fs';
import path from 'node:path';

export const DEFAULTS = {
  provider: 'openai', // 'openai', 'anthropic' or 'google' (see src/main/lib/ai.js)
  openaiApiKey: '',
  anthropicApiKey: '',
  googleApiKey: '',
  lastMode: 'translate', // the launcher opens in the mode you used last: 'translate' (main → second) or 'reverse'
  realtimeMode: false, // pick the mode from the language you type in (see languageQuestion in src/main/lib/prompts.js)
  cacheEnabled: true, // answer the same request again from the cache (see src/main/lib/cache.js)
  theme: 'system', // 'system', 'light' or 'dark'
  mainLanguage: 'Portuguese (Brazil)',
  secondLanguages: ['English'], // the languages you are learning (pick them in Settings)
  secondLanguage: 'English', // the one in use (switch it from the menu bar icon)
  ankiEnabled: false, // create an Anki card for each translation
  ankiDecks: {}, // the deck of each second language: { English: 'English::Phrases' }
  voices: {}, // the text to speech voice of each second language: { English: 'Samantha' } (see src/renderer/speech.js)
};

// Fills in the defaults and upgrades settings saved by older versions.
export function normalizeSettings({ apiKey, ankiDeck, defaultMode, ...saved }) {
  // Older versions only supported OpenAI and saved its key as `apiKey`.
  const settings = { ...DEFAULTS, openaiApiKey: apiKey ?? '', ...saved };
  // Older versions had a single second language: keep it in the list.
  if (!saved.secondLanguages) settings.secondLanguages = [settings.secondLanguage];
  // Older versions had a single deck: use it for every language.
  if (!saved.ankiDecks && ankiDeck) {
    settings.ankiDecks = Object.fromEntries(settings.secondLanguages.map((language) => [language, ankiDeck]));
  }
  // Older versions always started in the mode picked in Settings: start in it until you use another one.
  if (!saved.lastMode && defaultMode) settings.lastMode = defaultMode;
  // Older versions had an Explain mode: it's now the translation the other way.
  if (settings.lastMode === 'explain') settings.lastMode = 'reverse';
  return settings;
}

// Reads and writes the settings in a JSON file. The app uses the one in src/main/store.js.
export function createSettingsStore(file) {
  function load() {
    try {
      return normalizeSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(changes) {
    const settings = { ...load(), ...changes };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // 0o600: only your user can read it, since it holds the API keys.
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), { mode: 0o600 });
    return settings;
  }

  return { load, save };
}
