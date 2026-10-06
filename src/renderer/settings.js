const form = document.getElementById('form');
const fields = form.elements;
const KEY_FIELDS = { openai: 'openaiApiKey', anthropic: 'anthropicApiKey', google: 'googleApiKey' };

// Only the key of the selected provider is required, and the deck only when Anki is on.
function updateRequired() {
  for (const [provider, field] of Object.entries(KEY_FIELDS)) {
    fields[field].required = provider === fields.provider.value;
  }
  fields.ankiDeck.required = fields.ankiEnabled.checked;
}

// --- Second languages: a list with a radio for the one in use ---

const languageList = document.getElementById('second-languages');
const newLanguage = document.getElementById('new-language');

const secondLanguages = () => [...languageList.querySelectorAll('input')].map((radio) => radio.value);

function renderLanguages(languages, current) {
  languageList.replaceChildren(
    ...languages.map((language) => {
      const item = document.createElement('li');
      const label = document.createElement('label');
      const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'secondLanguage', value: language });
      radio.checked = language === current;
      label.append(radio, language);
      const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'remove', textContent: '×', title: 'Remove' });
      remove.addEventListener('click', () => removeLanguage(language));
      item.append(label, remove);
      return item;
    }),
  );
  // At least one language: when the list is empty, the "Add" field must be filled.
  newLanguage.required = languages.length === 0;
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

// Shows whether AnkiConnect answers and fills the deck list.
async function checkAnki(selectedDeck = fields.ankiDeck.value) {
  const status = document.getElementById('anki-status');
  status.textContent = 'Checking…';
  status.className = '';

  const { decks = [], error } = await window.api.getAnkiDecks();
  status.textContent = error ? `Not connected: ${error}` : 'Connected to AnkiConnect';
  status.className = error ? 'off' : 'on';

  // Keep the saved deck even when Anki is closed, so saving doesn't lose it.
  const names = [...new Set([...decks, selectedDeck].filter(Boolean))];
  fields.ankiDeck.replaceChildren(...names.map((name) => new Option(name, name)));
  fields.ankiDeck.value = selectedDeck || names[0] || '';
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
  renderLanguages(settings.secondLanguages, settings.secondLanguage);
  updateRequired();
  checkAnki(settings.ankiDeck);
});

fields.provider.addEventListener('change', updateRequired);
fields.ankiEnabled.addEventListener('change', updateRequired);
document.getElementById('anki-refresh').addEventListener('click', () => checkAnki());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  addLanguage(); // typed in "Add a language…" but didn't press Add
  const values = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, value.trim()]));
  values.ankiEnabled = fields.ankiEnabled.checked;
  values.openAtLogin = fields.openAtLogin.checked;
  values.secondLanguages = secondLanguages();
  values.secondLanguage = currentLanguage();
  await window.api.saveSettings(values);
  window.close();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close();
});
