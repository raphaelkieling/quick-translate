const form = document.getElementById('form');
const KEY_FIELDS = { openai: 'openaiApiKey', anthropic: 'anthropicApiKey', google: 'googleApiKey' };

// Only the key of the selected provider is required.
function updateRequiredKey() {
  for (const [provider, field] of Object.entries(KEY_FIELDS)) {
    form.elements[field].required = provider === form.elements.provider.value;
  }
}

window.api.getSettings().then((settings) => {
  for (const [name, value] of Object.entries(settings)) {
    if (form.elements[name]) form.elements[name].value = value;
  }
  updateRequiredKey();
});

form.elements.provider.addEventListener('change', updateRequiredKey);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const values = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, value.trim()]));
  await window.api.saveSettings(values);
  window.close();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close();
});
