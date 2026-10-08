import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Records the phrases for the Anki cards with the macOS `say` command, with the voice the launcher reads them with.

const run = promisify(execFile);

// `say -v '?'` prints a line per voice: "Eddy (English (US)) en_US    # Hello! My name is Eddy."
export const parseVoices = (output) =>
  output
    .split('\n')
    .map((line) => line.match(/^(.+?)\s+([a-z]{2,3}_\w+)\s+#/))
    .filter(Boolean)
    .map(([, name, lang]) => ({ name, lang: lang.replace('_', '-') }));

const baseName = (name) => name.replace(/\s*\(.*$/, '');

// The `say` voice for a voice of the launcher ({ name, lang }, from speechSynthesis). The names don't
// always match: "Eddy (English (United States))" in the launcher is "Eddy (English (US))" for `say`.
export const findVoice = (voices, { name, lang }) =>
  voices.find((voice) => voice.name === name) ??
  voices.find((voice) => voice.lang === lang && baseName(voice.name) === baseName(name));

// The same text with the same voice is the same file: Anki keeps one copy.
export const audioFilename = (text, voiceName) =>
  `quicktranslate-${createHash('sha1').update(`${voiceName}\n${text}`).digest('hex').slice(0, 16)}.m4a`;

// `text` read by `voice`, as { filename, data } (base64 AAC). Null when `say` has no such voice.
export async function recordSpeech(text, voice) {
  const { stdout } = await run('say', ['-v', '?']);
  const sayVoice = findVoice(parseVoices(stdout), voice);
  if (!sayVoice) return null;

  const dir = await mkdtemp(join(tmpdir(), 'quicktranslate-'));
  try {
    const file = join(dir, 'speech.m4a');
    // The text goes through stdin, so a phrase starting with "-" isn't read as an option.
    const recording = run('say', ['-v', sayVoice.name, '-o', file]);
    recording.child.stdin.end(text);
    await recording;
    return { filename: audioFilename(text, sayVoice.name), data: (await readFile(file)).toString('base64') };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
