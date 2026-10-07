import { boldToHtml, stripBold } from '../../shared/text.js';
import { loadVoices, pickVoice, speak, stopSpeaking } from '../speech.js';
import { MODES, MODE_IDS, ankiCard, direction, forLanguage, hint, languages, markdown } from './view.js';

// Feather icons (MIT), https://feathericons.com
const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  volume:
    '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
};

const $ = (id) => document.getElementById(id);
const input = $('input');

let settings = {};
let step = 'pick'; // 'pick' a mode while typing, then 'ask' shows the answer
let mode = 'translate'; // highlighted mode while picking, chosen mode while asking
let language = ''; // highlighted second language while picking, chosen one while asking
let status = null; // { text, error }
let anki = null; // result of the last "add to Anki": { text, error }
let question = ''; // the text that was asked
let answerMode = ''; // the mode of the answer on screen (Tab can change `mode` afterwards)
let summary = '';
let items = [];
let added = new Set(); // items already added to Anki
let selected = -1; // highlighted item, -1 for none
let copied = -1; // item that was just copied
let speaking = -1; // item being read aloud
let systemVoices = []; // the text to speech voices installed on the Mac
let requestId = 0; // used to ignore answers to outdated requests

// --- Rendering ---

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// The text and the note can have **bold** words (see src/main/lib/prompts.js).
function listItem(text, note, className, onClick, aside, tag = 'li') {
  const li = el(tag, className);
  const body = el('div', 'body');
  const textNode = el('div', 'text');
  const noteNode = el('div', 'note');
  textNode.innerHTML = boldToHtml(text);
  noteNode.innerHTML = boldToHtml(note);
  body.append(textNode, noteNode);
  li.append(body, aside);
  li.onclick = onClick;
  return li;
}

const canAddToAnki = () => settings.ankiEnabled;

// The answers are in the second language: read them with its voice (picked in Settings).
const voice = () => pickVoice(language, systemVoices, settings.voices?.[language]);

function itemButton(className, html, title, onClick) {
  const button = el('span', `item-button ${className}`);
  button.innerHTML = html;
  button.title = title;
  button.onclick = (e) => {
    e.stopPropagation();
    onClick();
  };
  return button;
}

function speakButton(i) {
  const isSpeaking = i === speaking;
  return itemButton(isSpeaking ? 'speak speaking' : 'speak', ICONS.volume, isSpeaking ? 'Stop' : 'Listen (⌘↵)', () =>
    speakItem(i),
  );
}

function itemActions(i) {
  const actions = el('div', 'item-actions');
  if (canAddToAnki()) {
    const isAdded = added.has(i);
    actions.append(
      itemButton(isAdded ? 'done' : '', isAdded ? `${ICONS.check}Anki` : `${ICONS.plus}Anki`, 'Add to Anki (⇧↵)', () =>
        addItemToAnki(i),
      ),
    );
  }
  const isCopied = i === copied;
  actions.append(
    itemButton(isCopied ? 'done' : '', isCopied ? `${ICONS.check}Copied` : ICONS.copy, 'Copy (↵)', () => copyItem(i)),
  );
  return actions;
}

// A row for each second language, with its modes side by side.
function languageRow(lang) {
  const languageSettings = forLanguage(settings, lang);
  const row = el('li');
  row.append(
    ...MODE_IDS.map((id) =>
      listItem(
        direction(id, languageSettings),
        MODES[id].description(languageSettings),
        lang === language && id === mode ? 'cell selected' : 'cell',
        () => chooseMode(id, lang),
        el('span', 'tag', MODES[id].label),
        'div',
      ),
    ),
  );
  return row;
}

function render() {
  const picking = step === 'pick';
  const languageSettings = forLanguage(settings, language);

  $('badge').hidden = picking;
  $('badge').textContent = direction(mode, languageSettings);
  $('badge').title = `${MODES[mode].label} (⌫ to change)`;
  input.placeholder = MODES[mode].placeholder(languageSettings);

  $('modes').hidden = !picking;
  $('modes').replaceChildren(...languages(settings).map(languageRow));
  $('modes').querySelector('.selected')?.scrollIntoView({ block: 'nearest' });

  $('status').hidden = picking || !status;
  $('status').textContent = status?.text ?? '';
  $('status').className = status?.error ? 'error' : '';

  $('summary').hidden = picking || !summary;
  $('summary').innerHTML = markdown(summary);

  $('items').hidden = picking || items.length === 0;
  $('items').replaceChildren(
    ...items.map((item, i) => {
      const li = listItem(item.text, item.note, i === selected ? 'selected' : '', () => copyItem(i), itemActions(i));
      if (voice()) li.prepend(speakButton(i));
      return li;
    }),
  );
  $('items').children[selected]?.scrollIntoView({ block: 'nearest' });

  $('hint').textContent = hint({ step, selected, canAddToAnki: canAddToAnki(), canSpeak: Boolean(voice()) });
  $('anki').hidden = picking || !anki;
  $('anki').textContent = anki?.text ?? '';
  $('anki').className = anki?.error ? 'error' : '';
}

// --- Actions ---

function reset(newSettings) {
  settings = newSettings;
  step = 'pick';
  mode = settings.defaultMode;
  language = settings.secondLanguage;
  status = null;
  anki = null;
  summary = '';
  items = [];
  selected = -1;
  copied = -1;
  stopItem();
  requestId++;
  input.value = '';
  render();
  input.focus();
}

// Clicking a mode asks right away when there is something typed.
function chooseMode(id, lang) {
  mode = id;
  language = lang;
  render();
  input.focus();
  submit();
}

function backToModes() {
  step = 'pick';
  stopItem();
  status = null;
  anki = null;
  summary = '';
  items = [];
  selected = -1;
  requestId++;
  render();
}

function nextMode(offset) {
  const index = MODE_IDS.indexOf(mode) + offset;
  mode = MODE_IDS[(index + MODE_IDS.length) % MODE_IDS.length];
  selected = -1; // so Enter asks again in the new mode
  render();
}

function nextLanguage(offset) {
  const list = languages(settings);
  const index = list.indexOf(language) + offset;
  language = list[(index + list.length) % list.length];
  render();
}

function selectItem(i) {
  selected = Math.max(-1, Math.min(i, items.length - 1));
  render();
}

async function submit() {
  const text = input.value.trim();
  if (!text) return;

  const id = ++requestId;
  step = 'ask';
  stopItem();
  status = { text: 'Thinking…' };
  anki = null;
  summary = '';
  items = [];
  selected = -1;
  render();

  const { output, error } = await window.api.ask(mode, text, language);
  if (id !== requestId) return;

  if (error) {
    status = { text: error, error: true };
  } else {
    status = null;
    question = text;
    answerMode = mode;
    summary = output.summary;
    items = output.items;
    added = new Set();
    selected = items.length ? 0 : -1;
  }
  render();
}

async function addItemToAnki(i) {
  if (!canAddToAnki() || added.has(i)) return;
  const id = requestId;
  selected = i;
  render();

  const result = await window.api.addToAnki(...ankiCard(answerMode, question, items[i]), language);
  if (id !== requestId) return;
  if (result.error) {
    anki = { text: `Anki: ${result.error}`, error: true };
  } else {
    added.add(i);
    anki = { text: `Added to Anki (${result.deck})` };
  }
  render();
}

function stopItem() {
  stopSpeaking();
  speaking = -1;
}

// Click again to stop.
function speakItem(i) {
  const v = voice();
  if (!v) return;
  selected = i;
  if (speaking === i) {
    stopItem();
  } else {
    speaking = i;
    speak(stripBold(items[i].text), v, () => {
      speaking = -1;
      render();
    });
  }
  render();
}

function copyItem(i) {
  window.api.copy(stripBold(items[i].text));
  selected = i;
  copied = i;
  render();
  setTimeout(() => {
    if (copied !== i) return;
    copied = -1;
    render();
  }, 1200);
}

// --- Keyboard and mouse ---

// Each returns true when it handled the key.
// While picking, the bare arrows choose the mode: ⌥ and ⌘ arrows still move the cursor in the text.
function onPickKey(key, withModifier) {
  if (withModifier && key.startsWith('Arrow')) return false;
  if (key === 'ArrowDown') nextLanguage(1);
  else if (key === 'ArrowUp') nextLanguage(-1);
  else if (key === 'ArrowRight' || key === 'Tab') nextMode(1);
  else if (key === 'ArrowLeft') nextMode(-1);
  else if (key === 'Enter') submit();
  else return false;
  return true;
}

function onAskKey(key, shiftKey, metaKey) {
  if (key === 'Tab') nextMode(1);
  else if (key === 'ArrowDown' && items.length) selectItem(selected + 1);
  else if (key === 'ArrowUp' && items.length) selectItem(selected - 1);
  else if (key === 'Enter' && shiftKey && selected >= 0) addItemToAnki(selected);
  else if (key === 'Enter' && metaKey && selected >= 0) speakItem(selected);
  else if (key === 'Enter' && selected >= 0) copyItem(selected);
  else if (key === 'Enter') submit();
  else if (key === 'Backspace' && input.value === '') backToModes();
  else return false;
  return true;
}

document.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Escape') return window.api.hide();
  const withModifier = e.altKey || e.metaKey || e.ctrlKey || e.shiftKey;
  const handled = step === 'pick' ? onPickKey(e.key, withModifier) : onAskKey(e.key, e.shiftKey, e.metaKey);
  if (handled) e.preventDefault();
});

input.addEventListener('input', () => {
  // Changing the text shows the modes again, to ask in any of them.
  if (step === 'ask') backToModes();
});

$('badge').onclick = () => {
  backToModes();
  input.focus();
};
$('settings').onclick = () => window.api.openSettings();

// Keep the focus in the input when clicking around.
for (const id of ['badge', 'settings', 'modes', 'items']) {
  $(id).addEventListener('mousedown', (e) => e.preventDefault());
}
window.addEventListener('focus', () => input.focus());

// The window grows and shrinks with its content.
new ResizeObserver(() => window.api.resize($('app').getBoundingClientRect().height)).observe($('app'));

window.api.onShow(reset);
loadVoices().then((voices) => {
  systemVoices = voices;
  render();
});
