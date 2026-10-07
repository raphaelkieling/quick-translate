// Used by both the main process (src/main) and the windows (src/renderer).

export const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// "Portuguese (Brazil)" -> "Portuguese", to keep the labels short.
export const shortName = (language = '') => language.replace(/\s*\(.*\)$/, '');
