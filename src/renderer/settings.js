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
  updateRequired();
  checkAnki(settings.ankiDeck);
});

fields.provider.addEventListener('change', updateRequired);
fields.ankiEnabled.addEventListener('change', updateRequired);
document.getElementById('anki-refresh').addEventListener('click', () => checkAnki());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const values = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, value.trim()]));
  values.ankiEnabled = fields.ankiEnabled.checked;
  values.openAtLogin = fields.openAtLogin.checked;
  await window.api.saveSettings(values);
  window.close();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close();
});
