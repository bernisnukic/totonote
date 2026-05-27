# TotoNote

A local-first desktop app for organizing lore and world-building notes. Rich-text editor with inline annotation/tagging, section-based navigation, and category browsing — wrapped in a dark, retro-terminal aesthetic.

> ⚠️ **Early / dev project.** Release builds are **unsigned**, so macOS Gatekeeper and Windows SmartScreen will warn on first launch. See [Install](#install) for how to get past the warnings.

## Features

- **Rich text editor** built on TipTap / ProseMirror
- **Annotations as decorations** — highlight any span of text and tag it; highlights stay anchored to the right text as you edit
- **Sections & categories** for structuring large worlds
- **Search, filtering, and metadata** management
- **Local-first** — everything lives in a single SQLite database on your machine; no account, no cloud
- **Fast, keyboard-friendly, dark UI**

## Install

Grab a build for your OS from the [Releases](../../releases) page.

Because the app isn't code-signed yet, your OS will warn you the first time you open it:

- **macOS** — right-click the app → **Open**, then confirm. (Or clear quarantine: `xattr -dr com.apple.quarantine /Applications/TotoNote.app`.)
- **Windows** — on the SmartScreen prompt, click **More info → Run anyway**.
- **Linux** — install the `.deb` (`sudo dpkg -i totonote_*.deb`) or `.rpm` (`sudo rpm -i totonote-*.rpm`).

## Development

Requires Node.js (LTS recommended).

```bash
npm install
npm start            # dev mode (Electron Forge + Vite HMR)
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright)
npm run lint         # ESLint
npm run make         # build distributables for the current OS
```

## Tech stack

Electron Forge + Vite · React 19 + TypeScript · TipTap (ProseMirror) · SQLite (better-sqlite3) · Zustand.

## Releases

Pushing a `v*` tag (e.g. `v1.0.0`) triggers the GitHub Actions **Build** workflow, which builds macOS, Windows, and Linux artifacts and attaches them to a GitHub Release. You can also run the workflow manually from the **Actions** tab.

```bash
git tag v1.0.0
git push origin v1.0.0
```

## License

[MIT](LICENSE) © Bernis Nukić
