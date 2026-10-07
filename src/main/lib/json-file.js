import fs from 'node:fs';
import path from 'node:path';

// A list saved as JSON, for the history and the cache. Losing them is not a big deal:
// a missing or broken file reads as an empty list, and a failed write is only logged.

export function readList(file) {
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeList(file, list) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // 0o600: only your user can read it, since it holds what you typed.
    fs.writeFileSync(file, JSON.stringify(list), { mode: 0o600 });
  } catch (error) {
    console.error(`Could not save ${file}:`, error);
  }
}
