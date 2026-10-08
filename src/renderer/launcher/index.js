import { boldToHtml, stripBold } from '../../shared/text.js';
import { loadVoices, pickVoice, speak, stopSpeaking } from '../speech.js';
import {
  MODES,
  MODE_IDS,
  ankiCard,
  answersInSecondLanguage,
  badge,
  direction,
  forLanguage,
  hint,
  historyPreview,
  languages,
  markdown,
  timeAgo,
} from './view.js';

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
let cached = false; // the answer on screen came from the cache
let added = new Set(); // items already added to Anki
let selected = -1; // highlighted item, -1 for none
let copied = -1; // item that was just copied
let speaking = -1; // item being read aloud
let systemVoices = []; // the text to speech voices installed on the Mac
let requestId = 0; // used to ignore answers to outdated requests
let decision = null; // Real Time Mode: { text, result, pending } of the last text sent
let decideTimer = 0;
let pickedByHand = false; // choosing a mode yourself turns Real Time Mode off until the text is cleared
let autoPicked = false; // the highlighted mode was picked by Real Time Mode
let history = []; // the last answers, newest first (see src/main/lib/history.js)
let historySelected = -1; // highlighted history entry while picking, -1 when it's a mode

// --- Rendering ---

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// The text and the note can have **bold** words (see src/main/lib/prompts.js). Without a note, only the text.
function listItem(text, note, className, onClick, aside, tag = 'li') {
  const li = el(tag, className);
  const body = el('div', 'body');
  const textNode = el('div', 'text');
  textNode.innerHTML = boldToHtml(text);
  body.append(textNode);
  if (note) {
    const noteNode = el('div', 'note');
    noteNode.innerHTML = boldToHtml(note);
    body.append(noteNode);
  }
  li.append(body, aside);
  li.onclick = onClick;
  return li;
}

const canAddToAnki = () => settings.ankiEnabled;

// The voice of the second language, picked in Settings. It also reads the phrases on the Anki cards.
const secondLanguageVoice = () => pickVoice(language, systemVoices, settings.voices?.[language]);

// Only the answers in the second language are read aloud: there is no voice to pick for the main language.
const voice = () =>
  answersInSecondLanguage(answerMode || mode, forLanguage(settings, language)) ? secondLanguageVoice() : undefined;

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
        '',
        lang === language && id === mode && historySelected < 0 ? `cell selected${autoPicked ? ' auto' : ''}` : 'cell',
        () => chooseMode(id, lang),
        el('span', 'tag', MODES[id].label),
        'div',
      ),
    ),
  );
  row.querySelector('.auto')?.setAttribute('title', 'Picked by Real Time Mode');
  return row;
}

// Older versions had an Explain mode: its answers are not shown.
const knownModes = (list) => list.filter((entry) => MODES[entry.mode]);

// Shown under the modes until you type something.
const showsHistory = () => step === 'pick' && !input.value.trim() && history.length > 0;

function historyRow(entry, i) {
  const li = listItem(
    entry.text,
    historyPreview(entry),
    i === historySelected ? 'selected' : '',
    () => openHistory(i),
    el('span', 'tag', timeAgo(entry.at)),
  );
  li.title = badge(entry.mode, forLanguage(settings, entry.language));
  return li;
}

function render() {
  const picking = step === 'pick';
  const languageSettings = forLanguage(settings, language);

  $('badge').hidden = picking;
  $('badge').textContent = badge(mode, languageSettings);
  $('badge').title = `${MODES[mode].label} (⌫ to change)`;
  input.placeholder = MODES[mode].placeholder(languageSettings);

  $('modes').hidden = !picking;
  $('modes').replaceChildren(...languages(settings).map(languageRow));
  $('modes').querySelector('.selected')?.scrollIntoView({ block: 'nearest' });

  $('history').hidden = !showsHistory();
  $('history-list').replaceChildren(...(showsHistory() ? history.map(historyRow) : []));
  $('history-list').children[historySelected]?.scrollIntoView({ block: 'nearest' });

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

  $('deciding').hidden = !decision?.pending;
  $('hint').textContent = hint({
    step,
    selected,
    inHistory: historySelected >= 0,
    canAddToAnki: canAddToAnki(),
    canSpeak: Boolean(voice()),
  });
  $('anki').hidden = picking || !anki;
  $('anki').textContent = anki?.text ?? '';
  $('anki').className = anki?.error ? 'error' : '';
  $('cached').hidden = picking || !cached || Boolean(anki);
}

// --- Actions ---

function reset(newSettings, newHistory) {
  settings = newSettings;
  history = knownModes(newHistory);
  historySelected = -1;
  step = 'pick';
  mode = MODES[settings.lastMode] ? settings.lastMode : 'translate';
  language = settings.secondLanguage;
  status = null;
  anki = null;
  summary = '';
  items = [];
  cached = false;
  selected = -1;
  copied = -1;
  stopItem();
  requestId++;
  clearTimeout(decideTimer);
  decision = null;
  pickedByHand = false;
  autoPicked = false;
  input.value = '';
  render();
  input.focus();
}

// Clicking a mode asks right away when there is something typed.
function chooseMode(id, lang) {
  pickByHand();
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
  pickByHand();
  historySelected = -1;
  const index = MODE_IDS.indexOf(mode) + offset;
  mode = MODE_IDS[(index + MODE_IDS.length) % MODE_IDS.length];
  selected = -1; // so Enter asks again in the new mode
  render();
}

function nextLanguage(offset) {
  pickByHand();
  const list = languages(settings);
  const index = list.indexOf(language) + offset;
  language = list[(index + list.length) % list.length];
  render();
}

// In the history: -1 goes back to the modes.
function selectHistory(i) {
  historySelected = Math.max(-1, Math.min(i, history.length - 1));
  render();
}

// ↓ on the last language goes into the history, when it's shown.
function moveDown() {
  if (historySelected >= 0) selectHistory(historySelected + 1);
  else if (showsHistory() && language === languages(settings).at(-1)) selectHistory(0);
  else nextLanguage(1);
}

function moveUp() {
  if (historySelected >= 0) selectHistory(historySelected - 1);
  else nextLanguage(-1);
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
  cached = false;
  selected = -1;
  render();

  // Pressed ↵ before Real Time Mode answered: wait for it (it's quick).
  if (realtime()) {
    clearTimeout(decideTimer);
    applyDecision(await decide(text));
    if (id !== requestId) return;
    render();
  }

  const response = await window.api.ask(mode, text, language);
  if (id !== requestId) return;

  if (response.error) {
    status = { text: response.error, error: true };
  } else {
    status = null;
    showAnswer(text, response.output, response.cached);
    window.api.getHistory().then((list) => {
      history = knownModes(list);
    });
  }
  render();
}

function showAnswer(text, output, fromCache) {
  step = 'ask';
  question = text;
  answerMode = mode;
  summary = output.summary;
  items = output.items;
  cached = fromCache;
  added = new Set();
  selected = items.length ? 0 : -1;
}

// Shows a past answer again, as if it was just asked.
function openHistory(i) {
  const entry = history[i];
  requestId++; // ignore a request still running
  clearTimeout(decideTimer);
  stopItem();
  pickByHand(); // keep its mode when asking again
  mode = entry.mode;
  language = entry.language;
  historySelected = -1;
  input.value = entry.text;
  status = null;
  anki = null;
  showAnswer(entry.text, entry.output, false);
  render();
  input.focus();
}

async function addItemToAnki(i) {
  if (!canAddToAnki() || added.has(i)) return;
  const id = requestId;
  selected = i;
  render();

  const v = secondLanguageVoice();
  const result = await window.api.addToAnki(
    ...ankiCard(answerMode, question, items[i]),
    language,
    v && { name: v.name, lang: v.lang },
  );
  if (id !== requestId) return;
  if (result.error) {
    anki = { text: `Anki: ${result.error}`, error: true };
  } else {
    added.add(i);
    anki = { text: `Added to Anki (${result.deck})${result.audio ? '' : ', without audio'}` };
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

// --- Real Time Mode: picks the mode and the language from the language you type in ---

const realtime = () => settings.realtimeMode && !pickedByHand;

function pickByHand() {
  pickedByHand = true;
  autoPicked = false;
}

// { mode, language } for the language of the text, or null when it failed or is another language
// (then you pick it as usual).
// Asking twice for the same text reuses the first answer.
function decide(text) {
  if (decision?.text !== text) {
    const current = { text, pending: true };
    current.result = window.api.decide(text).then((response) => {
      current.pending = false;
      if (decision === current) render();
      return response.decision ?? null;
    });
    decision = current;
    render(); // shows the loading icon in the footer
  }
  return decision.result;
}

function applyDecision(result) {
  if (!result) return;
  mode = result.mode;
  language = result.language;
  autoPicked = true;
}

// Waits for a pause in the typing, so it doesn't call the AI on every key. A paste goes right away.
function decideSoon(wait) {
  clearTimeout(decideTimer);
  const text = input.value.trim();
  if (!text) pickedByHand = false;
  if (!text || !realtime()) return;
  const run = async () => {
    const result = await decide(text);
    if (step !== 'pick' || !realtime() || input.value.trim() !== text) return;
    applyDecision(result);
    render();
  };
  if (wait) decideTimer = setTimeout(run, wait);
  else run();
}

// --- Keyboard and mouse ---

// Each returns true when it handled the key.
// While picking, the bare arrows choose the mode: ⌥ and ⌘ arrows still move the cursor in the text.
function onPickKey(key, withModifier) {
  if (withModifier && key.startsWith('Arrow')) return false;
  if (key === 'ArrowDown') moveDown();
  else if (key === 'ArrowUp') moveUp();
  else if (key === 'ArrowRight' || key === 'Tab') nextMode(1);
  else if (key === 'ArrowLeft') nextMode(-1);
  else if (key === 'Enter' && historySelected >= 0) openHistory(historySelected);
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

input.addEventListener('input', (e) => {
  // Changing the text shows the modes again, to ask in any of them.
  if (step === 'ask') backToModes();
  historySelected = -1;
  render(); // the history shows only while the text is empty
  decideSoon(e.inputType === 'insertFromPaste' ? 0 : 300);
});

$('badge').onclick = () => {
  backToModes();
  input.focus();
};
$('settings').onclick = () => window.api.openSettings();

// Keep the focus in the input when clicking around.
for (const id of ['badge', 'settings', 'modes', 'history', 'items']) {
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
