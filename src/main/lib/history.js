import { readList, writeList } from './json-file.js';

// The last answers, newest first, so the launcher can show them again (closing it by mistake loses nothing).
// Asking the same thing again moves it to the top. The app uses the one in src/main/store.js.
export function createHistory(file, limit = 30) {
  let entries; // read from the file on first use

  const list = () => (entries ??= readList(file));

  function add({ mode, language, text, output }, at = Date.now()) {
    const same = (entry) => entry.mode === mode && entry.language === language && entry.text === text;
    entries = [{ mode, language, text, output, at }, ...list().filter((entry) => !same(entry))].slice(0, limit);
    writeList(file, entries);
  }

  function clear() {
    entries = [];
    writeList(file, entries);
  }

  return { list, add, clear };
}
