import { loadVoices, speak, voicesFor } from '../speech.js';
import { guessDeck } from './decks.js';

const form = document.getElementById('form');
const fields = form.elements;
const KEY_FIELDS = { openai: 'openaiApiKey', anthropic: 'anthropicApiKey', google: 'googleApiKey' };

// Only the key of the selected provider is required, and the decks only when Anki is on.
function updateRequired() {
  for (const [provider, field] of Object.entries(KEY_FIELDS)) {
    fields[field].required = provider === fields.provider.value;
  }
  for (const select of deckList.querySelectorAll('select')) select.required = fields.ankiEnabled.checked;
}

// --- Second languages: a list with a radio for the one in use and a voice for each ---

const languageList = document.getElementById('second-languages');
const newLanguage = document.getElementById('new-language');

const secondLanguages = () => [...languageList.querySelectorAll('input')].map((radio) => radio.value);

function renderLanguages(languages, current) {
  rememberVoices();
  languageList.replaceChildren(
    ...languages.map((language) => {
      const item = document.createElement('li');
      const label = document.createElement('label');
      const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'secondLanguage', value: language });
      radio.checked = language === current;
      label.append(radio, language);
      const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'remove', textContent: '×', title: 'Remove' });
      remove.addEventListener('click', () => removeLanguage(language));
      item.append(label, ...voicePicker(language), remove);
      return item;
    }),
  );
  // At least one language: when the list is empty, the "Add" field must be filled.
  newLanguage.required = languages.length === 0;
  renderDecks();
}

function currentLanguage() {
  return languageList.querySelector('input:checked')?.value;
}

function addLanguage() {
  const language = newLanguage.value.trim();
  newLanguage.value = '';
  if (!language || secondLanguages().includes(language)) return;
  renderLanguages([...secondLanguages(), language], currentLanguage() ?? language);
}

function removeLanguage(language) {
  const languages = secondLanguages().filter((l) => l !== language);
  const current = currentLanguage();
  renderLanguages(languages, current === language ? languages[0] : current);
}

document.getElementById('add-language').addEventListener('click', addLanguage);
newLanguage.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault(); // don't save the form
  addLanguage();
});
// Switched from the menu bar icon while this window is open.
window.api.onSecondLanguage((language) => renderLanguages(secondLanguages(), language));

// --- Anki: one deck for each second language ---

const deckList = document.getElementById('anki-decks');
let ankiDecks = []; // the decks that exist in Anki (empty while it is closed)
let chosenDecks = {}; // { language: deck }, also remembers removed languages until the window closes

function renderDecks() {
  for (const { dataset, value } of deckList.querySelectorAll('select')) {
    // An empty select only counts once a deck was chosen, so the guess still runs after Anki answers.
    if (value || dataset.language in chosenDecks) chosenDecks[dataset.language] = value;
  }
  deckList.replaceChildren(
    ...secondLanguages().map((language) => {
      const deck = chosenDecks[language] ?? guessDeck(language, ankiDecks);
      // Keep the chosen deck even when Anki is closed, so saving doesn't lose it.
      const names = [...new Set([...ankiDecks, deck].filter(Boolean))];
      const select = document.createElement('select');
      select.dataset.language = language;
      select.append(new Option('Pick a deck…', ''), ...names.map((name) => new Option(name, name)));
      select.value = deck;
      const label = document.createElement('label');
      label.append(Object.assign(document.createElement('span'), { textContent: language, title: language }), select);
      const item = document.createElement('li');
      item.append(label);
      return item;
    }),
  );
  updateRequired();
}

// Shows whether AnkiConnect answers and fills the deck lists.
async function checkAnki() {
  const status = document.getElementById('anki-status');
  status.textContent = 'Checking…';
  status.className = '';

  const { decks = [], error } = await window.api.getAnkiDecks();
  status.textContent = error ? `Not connected: ${error}` : 'Connected to AnkiConnect';
  status.className = error ? 'off' : 'on';

  ankiDecks = decks;
  renderDecks();
}

// --- Voices: the text to speech voice of each second language ---

let systemVoices = []; // the voices installed on the Mac
let chosenVoices = {}; // { language: voiceURI }, also remembers removed languages until the window closes

function rememberVoices() {
  for (const { dataset, value } of languageList.querySelectorAll('select')) {
    if (value) chosenVoices[dataset.language] = value;
  }
}

// A select with the voices of the language and a button to hear the chosen one.
function voicePicker(language) {
  const voices = voicesFor(language, systemVoices);
  const select = document.createElement('select');
  select.dataset.language = language;
  select.title = 'Get more voices in System Settings → Accessibility → Spoken Content';
  select.disabled = voices.length === 0;
  if (select.disabled) select.append(new Option('No voice installed', ''));
  select.append(...voices.map((voice) => new Option(`${voice.name} (${voice.lang})`, voice.voiceURI)));
  // The best voice is first: keep it when nothing was chosen (or the chosen one was uninstalled).
  select.value = chosenVoices[language] ?? '';
  if (select.selectedIndex < 0) select.selectedIndex = 0;

  const listen = Object.assign(document.createElement('button'), { type: 'button', className: 'listen', textContent: '▶', title: 'Listen' });
  listen.disabled = select.disabled;
  // Says the name of the language, in that language: "português (Brasil)".
  listen.addEventListener('click', () => {
    const voice = voices.find((v) => v.voiceURI === select.value);
    speak(new Intl.DisplayNames([voice.lang], { type: 'language' }).of(voice.lang), voice);
  });
  return [select, listen];
}

window.api.getSettings().then((settings) => {
  for (const [name, value] of Object.entries(settings)) {
    const field = fields[name];
    if (field?.type === 'checkbox') field.checked = value;
    else if (field) field.value = value;
  }
  if (!settings.canOpenAtLogin) {
    fields.openAtLogin.disabled = true;
    fields.openAtLogin.parentElement.title = 'Only in the built app (npm run build)';
  }
  chosenDecks = { ...settings.ankiDecks };
  chosenVoices = { ...settings.voices };
  renderLanguages(settings.secondLanguages, settings.secondLanguage);
  checkAnki();
  loadVoices().then((voices) => {
    systemVoices = voices;
    renderLanguages(secondLanguages(), currentLanguage());
  });
});

fields.provider.addEventListener('change', updateRequired);
fields.ankiEnabled.addEventListener('change', updateRequired);
document.getElementById('anki-refresh').addEventListener('click', () => checkAnki());

// { language: value } of the selects in a list, without the empty ones.
const selectedPerLanguage = (list) =>
  Object.fromEntries(
    [...list.querySelectorAll('select')].filter((select) => select.value).map((select) => [select.dataset.language, select.value]),
  );

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  addLanguage(); // typed in "Add a language…" but didn't press Add
  const values = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, value.trim()]));
  values.ankiEnabled = fields.ankiEnabled.checked;
  values.openAtLogin = fields.openAtLogin.checked;
  values.secondLanguages = secondLanguages();
  values.secondLanguage = currentLanguage();
  values.ankiDecks = selectedPerLanguage(deckList);
  values.voices = selectedPerLanguage(languageList);
  await window.api.saveSettings(values);
  window.close();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close();
});
