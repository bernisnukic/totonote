# TotoNote - Claude Code Guide

## What This Is

Electron desktop app for organizing lore/world-building notes. Rich text editor with annotation/tagging, section-based navigation, category browsing, and metadata management. Single-user, local-first, dark retro/terminal aesthetic.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Shell | Electron Forge + Vite |
| Frontend | React 19 + TypeScript |
| Editor | TipTap (ProseMirror) |
| Database | SQLite via better-sqlite3 (synchronous) |
| State | Zustand (slices pattern) |
| Styling | Plain CSS + custom properties |
| Unit Tests | Vitest (run via Electron's Node for ABI compat) |
| E2E Tests | Playwright |

## Commands

```bash
npm start                  # Dev mode (Electron Forge + Vite HMR)
npm test                   # Unit tests (vitest via Electron's Node)
npm run test:e2e           # E2E tests (builds main+preload, then Playwright)
npm run test:e2e:build     # Build main+preload only (for E2E)
npm run lint               # ESLint
npm run make               # Package for distribution
```

### Testing Gotchas

- **Unit tests must run under Electron's Node** because better-sqlite3 is compiled against Electron's ABI. The `test` script uses `ELECTRON_RUN_AS_NODE=1 electron vitest`.
- **E2E tests** use `e2e/build-for-test.mjs` to build main+preload with Vite, then Playwright launches Electron with `TOTONOTE_DB_PATH` env var pointing to a temp DB. Each test gets a fresh database.
- **Node v24 breaks `npx`** — use direct paths like `node node_modules/vite/bin/vite.js` instead of `npx vite` in configs/scripts.
- **Playwright config** starts its own Vite renderer dev server on port 5173.

## Architecture

```
Renderer (React) → window.api.invoke(channel, args)
    → preload contextBridge → ipcRenderer.invoke
    → main ipcMain.handle → repository function → SQLite
    → result flows back
```

### Project Structure

```
src/
├── shared/              # Types shared between main & renderer
│   ├── domain-types.ts  # Document, Section, Tag, Category, Annotation, etc.
│   └── ipc-types.ts     # IpcHandlerMap: typed channel → args/result contracts
├── main/
│   ├── index.ts         # App entry, window creation, IPC registration
│   ├── db/
│   │   ├── connection.ts       # DB init, WAL mode, migration runner
│   │   ├── migrations/*.sql    # Numbered SQL migrations
│   │   └── repositories/       # One file per entity (plain functions, not classes)
│   └── ipc/handlers.ts         # All ipcMain.handle registrations
├── preload/preload.ts   # contextBridge exposes window.api
└── renderer/
    ├── index.tsx         # React root
    ├── App.tsx           # Routes between DocumentList and EditorArea
    ├── stores/           # Zustand slices (document, tag, annotation, selection, ui, filter, preference)
    ├── components/       # React components organized by area
    ├── extensions/       # Custom TipTap extensions
    ├── hooks/            # useDebounce, usePanelResize, useSectionScroll, etc.
    ├── lib/              # Utilities (ipc-client, annotation-utils, editor-registry, etc.)
    └── styles/           # CSS files with custom properties (tokens.css is the theme)
```

## Key Patterns

### IPC Channels
Naming: `entity:action` (e.g., `document:list`, `tag:create`, `annotation:batch-update-positions`).
All typed in `src/shared/ipc-types.ts` — add new channels there first, then implement handler + repo.

### Zustand Store
Slices pattern: each file exports an interface + `createXSlice` function. All composed in `stores/index.ts`. Access via `useStore(s => s.whatever)`.

- **document-slice**: active doc/section, CRUD, content saving
- **tag-slice**: tags, categories, document-tags
- **annotation-slice**: annotations, highlight visibility
- **selection-slice**: text selection range, active annotation
- **ui-slice**: sidebar widths/collapsed, active right tab, modals, context menu
- **filter-slice**: search, sort, filter, left sidebar mode
- **preference-slice**: shortcuts, theme

### Repositories
Plain exported functions (no classes). Use `getDb()` from connection.ts. Each has a `rowToEntity()` mapper for snake_case DB rows → camelCase domain types. UUID for IDs, ISO strings for timestamps.

### Annotations (Core Feature)
Annotations are **ProseMirror decorations**, NOT marks in the document JSON. They're stored as `(sectionId, tagId, fromPos, toPos)` in SQLite and rendered as colored inline decorations via a custom plugin (`extensions/annotation-decoration/`). Positions are mapped through edits using ProseMirror's transaction mapping.

The `editor-registry.ts` maintains a Map of active TipTap editor instances by section ID, enabling cross-component annotation operations.

### Editor Structure
All sections render as one scrollable page. Each section gets its own `SectionEditor` (TipTap instance). `useSectionScroll` uses IntersectionObserver for scroll-based tab switching. Content is debounce-saved (1000ms).

## Database

SQLite with WAL mode and foreign keys ON. Migrations in `src/main/db/migrations/` (numbered SQL files). Embedded fallback migrations in `connection.ts` for production builds where files aren't on disk.

**Tables**: documents, sections, categories, tags, annotations, document_tags, browse_categories, preferences, _migrations

**Default seed**: One "General" category (`cat-general`). No other pre-filled data.

**Adding migrations**: Create `NNN-name.sql` in migrations dir AND add the same SQL to the embedded migration function in `connection.ts`.

## Styling

Dark theme. CSS custom properties in `tokens.css`. Key tokens:
- `--bg-primary: #0a0a0a`, `--bg-secondary: #141414`, `--bg-tertiary: #1e1e1e`
- `--accent-primary: #48dbfb` (NOT `--accent` — that doesn't exist)
- `--text-primary: #e0e0e0`, `--text-muted: #666`
- Font: `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`

## Common Pitfalls

1. **CSS variable `--accent` doesn't exist** — use `--accent-primary`.
2. **Migration ordering matters for existing DBs** — if migration N already ran, you can't modify it. Create N+1 instead. Always test that new migrations work on DBs that already applied previous migrations.
3. **Categories must exist before tags** — tags have a FK to categories. If categories table is empty, tag creation fails silently unless you add validation.
4. **React controlled `<select>` race condition** — when options load async, the visual first-option doesn't match React state (`""`). Auto-select first option in a useEffect.
5. **Annotation decorations must re-sync** — when annotations change globally (e.g., from SelectionToolbar), SectionEditor must watch the global store and re-apply decorations. Don't rely only on mount-time loading.
6. **E2E build is separate from Forge build** — `e2e/build-for-test.mjs` builds main+preload independently. After changing main process code, rebuild with `npm run test:e2e:build` before running E2E tests.
7. **Electron Forge dev vs E2E** — Forge's `npm start` uses its own Vite plugin to build main/preload. E2E tests use the separate build script. Keep both paths working.

## Window Configuration

- macOS: hidden title bar with traffic lights at (12, 12)
- Initial: 1400x900, min: 900x600
- DevTools open in dev mode (skipped when `NODE_ENV=test`)
- `TOTONOTE_DB_PATH` env var overrides default DB location (used by tests)
