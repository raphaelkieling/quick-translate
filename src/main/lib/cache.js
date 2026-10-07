import { readList, writeList } from './json-file.js';

// The answers already given, so asking the same thing again is instant (turn it off in Settings).
// Once there are `limit` of them, the ones used least recently go. The app uses the one in src/main/store.js.
export function createCache(file, limit = 500) {
  let entries; // a Map of key -> value, read from the file on first use

  const load = () => (entries ??= new Map(readList(file).filter(Array.isArray)));
  const save = () => writeList(file, [...entries]);

  // undefined when it's not cached (null is a value that can be cached).
  function get(key) {
    const map = load();
    if (!map.has(key)) return undefined;
    // Used again: move it to the end, so it's the last to go. Saved with the next `set`.
    const value = map.get(key);
    map.delete(key);
    map.set(key, value);
    return value;
  }

  function set(key, value) {
    const map = load();
    map.delete(key);
    map.set(key, value);
    for (const oldest of map.keys()) {
      if (map.size <= limit) break;
      map.delete(oldest);
    }
    save();
  }

  function clear() {
    entries = new Map();
    save();
  }

  return { get, set, clear, size: () => load().size };
}
