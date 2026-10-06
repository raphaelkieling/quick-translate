<div align="center">
    <img src="build/icon.png" width="96" alt="QuickTranslate icon">
</div>

# Quick Translate

A Spotlight-like launcher for learning a second language. Double-tap **⌘** to open it.

- **Translate**: say it in your language, get natural ways to say it in the other.
- **Explain**: paste a word or sentence, get what it means.

Works with OpenAI, Claude or Gemini. Can send translations to Anki via [AnkiConnect](https://ankiweb.net/shared/info/2055492159).

## Run

```sh
npm install
npm start
```

## Install

```sh
npm run build
mv "dist/mac-arm64/QuickTranslate.app" /Applications/
```

On Intel Macs the folder is `dist/mac/`.

## First launch

1. Allow **Accessibility** in System Settings → Privacy & Security (needed for the double ⌘).
2. Fill in Settings: languages, API key, provider.

Find it in the menu bar as **文A**.
