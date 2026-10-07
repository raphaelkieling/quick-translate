import { shortName } from '../shared/text.js';

// Text to speech with the voices that come with macOS (Web Speech API).
// Install more voices in System Settings → Accessibility → Spoken Content → System voice → Manage Voices.

// macOS voices that sing, whisper or sound like robots: they go last and are never the default.
const NOVELTY = new Set([
  'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Fred', 'Good News', 'Jester',
  'Junior', 'Kathy', 'Organ', 'Ralph', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox',
]);
// The Eloquence voices ("Eddy (English (United States))") sound robotic too.
const isNovelty = (voice) => NOVELTY.has(voice.name) || /\(.*\(.*\)\)$/.test(voice.name);

const languageNames = new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' });

// How well a voice fits a language name like "Portuguese (Brazil)" or "English". 0 when it doesn't.
export function voiceScore(voice, language) {
  try {
    const locale = new Intl.Locale(voice.lang);
    // pt-BR -> "Portuguese (Brazil)"
    if (languageNames.of(voice.lang).toLowerCase() === language.toLowerCase()) return 3;
    if (languageNames.of(locale.language).toLowerCase() !== shortName(language).toLowerCase()) return 0;
    // "English" fits en-US (where it is most spoken) better than en-GB.
    return locale.region === new Intl.Locale(locale.language).maximize().region ? 2 : 1;
  } catch {
    return 0; // not a valid language tag
  }
}

// The voices for a language, the best ones first.
export function voicesFor(language, voices) {
  return voices
    .map((voice) => ({ voice, score: voiceScore(voice, language) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        isNovelty(a.voice) - isNovelty(b.voice) || b.score - a.score || a.voice.name.localeCompare(b.voice.name),
    )
    .map(({ voice }) => voice);
}

// The voice chosen in Settings, or the best one for the language. Undefined when there is none.
export const pickVoice = (language, voices, chosen) =>
  voices.find((voice) => voice.voiceURI === chosen && voiceScore(voice, language) > 0) ??
  voicesFor(language, voices)[0];

// The voices load in the background: wait for them.
export function loadVoices() {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
    setTimeout(() => resolve(speechSynthesis.getVoices()), 3000); // no voices at all
  });
}

let current = null; // the utterance playing

// Stops what is playing. Its `onEnd` doesn't run.
export function stopSpeaking() {
  if (current) current.onend = current.onerror = null;
  current = null;
  speechSynthesis.cancel();
}

// Stops what is playing and says `text`. `onEnd` runs when it finishes.
export function speak(text, voice, onEnd) {
  stopSpeaking();
  current = new SpeechSynthesisUtterance(text);
  current.voice = voice;
  current.lang = voice.lang;
  current.onend = current.onerror = () => {
    current = null;
    onEnd?.();
  };
  speechSynthesis.speak(current);
}
