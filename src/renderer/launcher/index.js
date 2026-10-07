import { MODES, MODE_IDS, ankiCard, direction, hint, markdown } from './view.js';

// Feather icons (MIT), https://feathericons.com
const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
};

const $ = (id) => document.getElementById(id);
const input = $('input');

let settings = {};
let step = 'pick'; // first 'pick' a mode, then 'ask'
let mode = 'translate'; // highlighted mode while picking, chosen mode while asking
let status = null; // { text, error }
let anki = null; // result of the last "add to Anki": { text, error }
let question = ''; // the text that was asked
let answerMode = ''; // the mode of the answer on screen (Tab can change `mode` afterwards)
let summary = '';
let items = [];
let added = new Set(); // items already added to Anki
let selected = -1; // highlighted item, -1 for none
let copied = -1; // item that was just copied
let requestId = 0; // used to ignore answers to outdated requests

// --- Rendering ---

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function listItem(text, note, className, onClick, aside) {
  const li = el('li', className);
  const body = el('div', 'body');
  body.append(el('div', 'text', text), el('div', 'note', note));
  li.append(body, aside);
  li.onclick = onClick;
  return li;
}

const canAddToAnki = () => settings.ankiEnabled;

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

function render() {
  const picking = step === 'pick';

  $('badge').hidden = picking;
  $('badge').textContent = direction(mode, settings);
  $('badge').title = `${MODES[mode].label} (⌫ to change)`;
  input.placeholder = picking ? 'Pick a mode or start typing…' : MODES[mode].placeholder(settings);

  $('modes').hidden = !picking;
  $('modes').replaceChildren(
    ...MODE_IDS.map((id) =>
      listItem(
        direction(id, settings),
        MODES[id].description(settings),
        id === mode ? 'selected' : '',
        () => chooseMode(id),
        el('span', 'tag', MODES[id].label),
      ),
    ),
  );

  $('status').hidden = picking || !status;
  $('status').textContent = status?.text ?? '';
  $('status').className = status?.error ? 'error' : '';

  $('summary').hidden = picking || !summary;
  $('summary').innerHTML = markdown(summary);

  $('items').hidden = picking || items.length === 0;
  $('items').replaceChildren(
    ...items.map((item, i) => {
      return listItem(item.text, item.note, i === selected ? 'selected' : '', () => copyItem(i), itemActions(i));
    }),
  );
  $('items').children[selected]?.scrollIntoView({ block: 'nearest' });

  $('hint').textContent = hint({ step, selected, canAddToAnki: canAddToAnki() });
  $('anki').hidden = picking || !anki;
  $('anki').textContent = anki?.text ?? '';
  $('anki').className = anki?.error ? 'error' : '';
}

// --- Actions ---

function reset(newSettings) {
  settings = newSettings;
  step = 'pick';
  mode = settings.defaultMode;
  status = null;
  anki = null;
  summary = '';
  items = [];
  selected = -1;
  copied = -1;
  requestId++;
  input.value = '';
  render();
  input.focus();
}

function chooseMode(id) {
  mode = id;
  step = 'ask';
  render();
  input.focus();
}

function backToModes() {
  step = 'pick';
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

function selectItem(i) {
  selected = Math.max(-1, Math.min(i, items.length - 1));
  render();
}

async function submit() {
  const text = input.value.trim();
  if (!text) return;

  const id = ++requestId;
  status = { text: 'Thinking…' };
  anki = null;
  summary = '';
  items = [];
  selected = -1;
  render();

  const { output, error } = await window.api.ask(mode, text);
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

  const result = await window.api.addToAnki(...ankiCard(answerMode, question, items[i]));
  if (id !== requestId) return;
  if (result.error) {
    anki = { text: `Anki: ${result.error}`, error: true };
  } else {
    added.add(i);
    anki = { text: `Added to Anki (${result.deck})` };
  }
  render();
}

function copyItem(i) {
  window.api.copy(items[i].text);
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
function onPickKey(key) {
  if (key === 'ArrowDown' || key === 'Tab') nextMode(1);
  else if (key === 'ArrowUp') nextMode(-1);
  else if (key === 'Enter') chooseMode(mode);
  else return false;
  return true;
}

function onAskKey(key, shiftKey) {
  if (key === 'Tab') nextMode(1);
  else if (key === 'ArrowDown' && items.length) selectItem(selected + 1);
  else if (key === 'ArrowUp' && items.length) selectItem(selected - 1);
  else if (key === 'Enter' && shiftKey && selected >= 0) addItemToAnki(selected);
  else if (key === 'Enter' && selected >= 0) copyItem(selected);
  else if (key === 'Enter') submit();
  else if (key === 'Backspace' && input.value === '') backToModes();
  else return false;
  return true;
}

document.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Escape') return window.api.hide();
  const handled = step === 'pick' ? onPickKey(e.key) : onAskKey(e.key, e.shiftKey);
  if (handled) e.preventDefault();
});

input.addEventListener('input', () => {
  // Typing while picking goes straight to the highlighted mode.
  if (step === 'pick' && input.value) step = 'ask';
  selected = -1;
  render();
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
