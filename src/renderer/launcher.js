// What each mode looks like in the launcher. The prompts are in src/prompts.js.
const MODES = {
  translate: {
    label: 'Translate',
    from: (s) => s.mainLanguage,
    to: (s) => s.secondLanguage,
    description: (s) => `Write in ${s.mainLanguage}, get natural ways to say it in ${s.secondLanguage}`,
    placeholder: (s) => `What do you want to say? Write in ${s.mainLanguage}…`,
  },
  explain: {
    label: 'Explain',
    from: (s) => s.secondLanguage,
    to: (s) => s.mainLanguage,
    description: (s) => `Write a word or phrase in ${s.secondLanguage}, get what it means in ${s.mainLanguage}`,
    placeholder: (s) => `A word or phrase in ${s.secondLanguage}…`,
  },
};
const MODE_IDS = Object.keys(MODES);

// "Portuguese (Brazil)" -> "Portuguese", to keep the labels short.
const shortName = (language = '') => language.replace(/\s*\(.*\)$/, '');
const direction = (id) => `${shortName(MODES[id].from(settings))} → ${shortName(MODES[id].to(settings))}`;

// Feather icons (MIT), https://feathericons.com
const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
};

const $ = (id) => document.getElementById(id);
const input = $('input');

let settings = {};
let step = 'pick'; // first 'pick' a mode, then 'ask'
let mode = 'translate'; // highlighted mode while picking, chosen mode while asking
let status = null; // { text, error }
let summary = '';
let items = [];
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

function copyButton(isCopied) {
  const button = el('span', 'copy');
  button.innerHTML = isCopied ? `${ICONS.check}Copied` : ICONS.copy;
  button.title = 'Copy (↵)';
  return button;
}

function hint() {
  if (step === 'pick') return '↑↓ choose   ↵ select   esc close';
  if (selected >= 0) return '↑↓ select   ↵ copy   ⇥ switch mode   esc close';
  return '↵ ask   ⇥ switch mode   ⌫ modes   esc close';
}

function render() {
  const picking = step === 'pick';

  $('badge').hidden = picking;
  $('badge').textContent = direction(mode);
  $('badge').title = `${MODES[mode].label} (⌫ to change)`;
  input.placeholder = picking ? 'Pick a mode or start typing…' : MODES[mode].placeholder(settings);

  $('modes').hidden = !picking;
  $('modes').replaceChildren(
    ...MODE_IDS.map((id) =>
      listItem(
        direction(id),
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
  $('summary').textContent = summary;

  $('items').hidden = picking || items.length === 0;
  $('items').replaceChildren(
    ...items.map((item, i) => {
      const className = [i === selected && 'selected', i === copied && 'copied'].filter(Boolean).join(' ');
      return listItem(item.text, item.note, className, () => copyItem(i), copyButton(i === copied));
    }),
  );
  $('items').children[selected]?.scrollIntoView({ block: 'nearest' });

  $('hint').textContent = hint();
}

// --- Actions ---

function reset(newSettings) {
  settings = newSettings;
  step = 'pick';
  mode = settings.defaultMode;
  status = null;
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
  summary = '';
  items = [];
  selected = -1;
  requestId++;
  render();
}

function nextMode(direction) {
  const index = MODE_IDS.indexOf(mode) + direction;
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
    summary = output.summary;
    items = output.items;
    selected = items.length ? 0 : -1;
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

function onAskKey(key) {
  if (key === 'Tab') nextMode(1);
  else if (key === 'ArrowDown' && items.length) selectItem(selected + 1);
  else if (key === 'ArrowUp' && items.length) selectItem(selected - 1);
  else if (key === 'Enter' && selected >= 0) copyItem(selected);
  else if (key === 'Enter') submit();
  else if (key === 'Backspace' && input.value === '') backToModes();
  else return false;
  return true;
}

document.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Escape') return window.api.hide();
  const handled = step === 'pick' ? onPickKey(e.key) : onAskKey(e.key);
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
