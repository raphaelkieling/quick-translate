# Quick Language

A small Spotlight-like launcher for macOS that helps you with a second language.
Double-tap **⌘ Command** anywhere to open it.

It has two modes:

- **Translate** (main → second language): type what you want to say in your main language and get a list of natural ways to say it in your second language. Press Enter on one to copy it.
- **Explain** (second → main language): type a word, expression or sentence and get what it means, explained in your main language, with examples.

It works with OpenAI, Claude or Gemini. You choose which one in Settings.

## Run

You need macOS, [Node.js](https://nodejs.org) 22.12 or newer, and an API key from OpenAI, Anthropic (Claude) or Google (Gemini).

```sh
npm install
npm start
```

The first time you run it:

1. **Allow Accessibility access.** macOS asks for it because the app has to listen for the double ⌘.
   Turn it on in **System Settings → Privacy & Security → Accessibility** for the app you ran `npm start` from (Terminal, iTerm, VS Code…).
   The shortcut starts working as soon as you turn it on.
2. **Fill in Settings.** The Settings window opens on its own. Pick your languages, paste an API key and choose which AI to use.

The app has no Dock icon. Look for **文A** in the menu bar to open the launcher or Settings, or to quit.

## Keys

| Key                   | What it does                                    |
| --------------------- | ----------------------------------------------- |
| `⌘` `⌘`               | Open or close the launcher                      |
| `↑` `↓` then `↵`      | Pick a mode (or just start typing)              |
| `↵`                   | Ask, or copy the selected answer                |
| `↑` `↓`               | Move through the answers                        |
| `⇥` Tab               | Switch mode                                     |
| `⌫` on an empty input | Back to the mode list                           |
| `⌘ ,`                 | Open Settings (or click ⚙︎ in the launcher)     |
| `esc`                 | Close                                           |

## Tuning the AI

All prompts live in [src/prompts.js](src/prompts.js). Edit them and run `npm start` again to try your changes.
The model used by each provider is set at the top of [src/ai.js](src/ai.js).

## Project structure

```
src/
  main.js        Windows, menu bar icon, messages between windows and the app
  hotkey.js      Detects the double ⌘ tap
  ai.js          Calls OpenAI, Claude or Gemini (via the Vercel AI SDK)
  prompts.js     Prompts and the answer format
  settings.js    Loads and saves settings
  preload.cjs    The bridge the windows use to talk to main.js
  renderer/      Launcher and Settings windows (plain HTML, CSS and JS, no build step)
```

Settings, including your API keys, are saved as plain JSON in
`~/Library/Application Support/quick-language/settings.json`. Only your macOS user can read that file.
