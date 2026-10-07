// Used by both the main process (src/main) and the windows (src/renderer).

export const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// "Portuguese (Brazil)" -> "Portuguese", to keep the labels short.
export const shortName = (language = '') => language.replace(/\s*\(.*\)$/, '');

// You mark the words you care about like **this**, and the AI marks them (or their translation) in the answers.
const BOLD = /\*\*(.+?)\*\*/g;

// "a **word** & more" -> "a <b>word</b> &amp; more", for the launcher and Anki.
export const boldToHtml = (text) => escapeHtml(text).replace(BOLD, '<b>$1</b>');

// "a **word**" -> "a word", for copying.
export const stripBold = (text) => text.replace(BOLD, '$1');
