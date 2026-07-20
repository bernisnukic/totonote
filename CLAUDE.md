# TotoNote - Claude Code Guide

## What This Is

Electron desktop app for organizing lore/world-building notes. Rich text editor with annotation/tagging, section-based navigation, category browsing, and metadata management. Single-user, local-first, dark retro/terminal aesthetic.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Shell | Electron Forge + Vite |
| Frontend | React 19 + TypeScript |
| Editor | TipTap (ProseMirror) |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
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
Plain exported functions (no classes). Use `getDb()` from connection.ts to access the Drizzle query builder (`db.select().from(...).where(eq(...))` etc). No hand-written SQL strings; no `rowToEntity` mappers — schema declares `text('section_label')` with JS field `sectionLabel`, so Drizzle returns camelCase rows directly. UUID for IDs (uuid v4 for most, `cat-<uuid>` prefix for categories), ISO strings for timestamps.

### Category Rules
A category can own a **rule**: a sub-category skeleton stamped onto each new child of that
category (`CHARACTERS` → every new child gets `HISTORY / ABILITIES / COLOUR PALETTE`). Stored in
`category_rules` as the raw indented text the user typed, one row per category; parsed by
`parseRuleTemplate()` in `src/shared/category-rule.ts` (shared — main applies it, the renderer
previews it). Indentation nests, so rules can be trees.

Rules apply to **direct children only**; grandchildren follow their own parent's rule. Applying a
rule merges rather than duplicates — a sub-category whose name already exists is reused and
recursed into, which is what makes "apply to existing sub-categories" safe to re-run.

### Annotations (Core Feature)
Annotations are **ProseMirror decorations**, NOT marks in the document JSON. They're stored as `(sectionId, tagId, fromPos, toPos)` in SQLite and rendered as colored inline decorations via a custom plugin (`extensions/annotation-decoration/`). Positions are mapped through edits using ProseMirror's transaction mapping.

The `editor-registry.ts` maintains a Map of active TipTap editor instances by section ID, enabling cross-component annotation operations.

### Editor Structure
All sections render as one scrollable page. Each section gets its own `SectionEditor` (TipTap instance). `useSectionScroll` uses IntersectionObserver for scroll-based tab switching. Content is debounce-saved (1000ms).

## Database

SQLite with WAL mode and foreign keys ON. Schema lives in `src/main/db/schema.ts` (Drizzle `sqliteTable()` declarations). On app start, the Drizzle migrator applies any new migrations from `src/main/db/migrations/` and records them in the `__drizzle_migrations` table.

**Tables**: documents, sections, categories, tags, annotations, document_tags, section_tags, browse_categories, category_rules, preferences, __drizzle_migrations

**Default seed**: One "General" category (`cat-general`). Inserted post-migrate in `connection.ts` via `INSERT OR IGNORE` so it's idempotent across launches.

**Workflow for schema changes**:
1. Edit `src/main/db/schema.ts`
2. `npm run db:generate` — Drizzle Kit diffs your schema against the previous snapshot and emits `NNNN_<name>.sql` + updated `meta/_journal.json` and `meta/NNNN_snapshot.json`
3. Commit schema.ts + everything in `migrations/`

**Packaged builds**: Forge's `packagerConfig.extraResource` copies the migrations folder to `Contents/Resources/migrations/` so the runtime migrator can find it via `process.resourcesPath`. The `verify-package.mjs` post-make check fails the build if migrations didn't get bundled.

**Local DB inspection**: `npm run db:studio` opens Drizzle Studio at localhost:4983 against your dev DB.

## Styling

Dark theme. CSS custom properties in `tokens.css`. Key tokens:
- `--bg-primary: #0a0a0a`, `--bg-secondary: #141414`, `--bg-tertiary: #1e1e1e`
- `--accent-primary: #48dbfb` (NOT `--accent` — that doesn't exist)
- `--text-primary: #e0e0e0`, `--text-muted: #666`
- Font: `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`

## Common Pitfalls

1. **CSS variable `--accent` doesn't exist** — use `--accent-primary`.
2. **Migrations are immutable once generated** — Drizzle Kit hashes each migration; editing an already-generated `.sql` file desyncs the hash and breaks startup. If you need to fix a migration, edit `schema.ts` and run `db:generate` again to produce a new migration on top.
3. **Categories must exist before tags** — tags have a FK to categories. If categories table is empty, tag creation fails silently unless you add validation.
4. **React controlled `<select>` race condition** — when options load async, the visual first-option doesn't match React state (`""`). Auto-select first option in a useEffect.
5. **Annotation decorations must re-sync** — when annotations change globally (e.g., from SelectionToolbar), SectionEditor must watch the global store and re-apply decorations. Don't rely only on mount-time loading.
6. **E2E build is separate from Forge build** — `e2e/build-for-test.mjs` builds main+preload independently. After changing main process code, rebuild with `npm run test:e2e:build` before running E2E tests.
7. **Electron Forge dev vs E2E** — Forge's `npm start` uses its own Vite plugin to build main/preload. E2E tests use the separate build script. Keep both paths working.
8. **Foreign keys must be OFF across `migrate()`** — `connection.ts` and `test-helpers.ts` toggle the pragma around the call, not inside it. Drizzle Kit emits any table alteration as a rebuild (`DROP TABLE` + rename), and with enforcement on that DROP cascades and silently empties tags/annotations/document_tags. The `PRAGMA foreign_keys=OFF` inside the generated `.sql` cannot help — the migrator wraps every statement in one `BEGIN`, and SQLite ignores that pragma inside a transaction. `src/main/db/migration.test.ts` guards this.
9. **Node builtins must be externalized in `e2e/build-for-test.mjs` under both spellings** — listing `fs` does not cover drizzle-orm's `node:fs` import, and Vite silently replaces the unmatched builtin with `{}`. That produced `crypto$1.existsSync is not a function` at startup, so the window never opened and *every* E2E test failed in `beforeEach`. The script now externalizes `builtinModules` plus their `node:`-prefixed forms.
10. **Category names are unique per parent, not globally** — enforced by `idx_categories_parent_name` plus a partial `idx_categories_root_name` for root rows (SQLite treats NULLs as distinct in a unique index, so the first index alone would not constrain roots). Repository checks are case-insensitive; the indexes are the exact-match backstop.
11. **`npm run make` clobbers the E2E build** — Forge writes its own production `.vite/build/index.js`, which loads the prebuilt renderer from `.vite/renderer/` instead of the dev server. E2E tests and the screenshot generator then run against a **stale renderer bundle** and silently test old code — no error, just confusing results. Always re-run `npm run test:e2e:build` after `npm run make`. Quick check: `grep -o 'http://localhost:[0-9]*' .vite/build/index.js` should print the dev server URL.
12. **Databases from v1.0.4 and earlier need adopting** — they track migrations in `_migrations`, not `__drizzle_migrations`, so the migrator would re-run `0000_initial` and crash on "table already exists". `src/main/db/legacy-baseline.ts` rebuilds `categories` (its inline `UNIQUE` is an implicit autoindex that cannot be dropped) and records 0000 as applied, before `migrate()` runs.

## Documentation

End-user docs live in `docs/` as markdown, so the same files render on GitHub and can be
bundled into an in-app help panel later. `CLAUDE.md` and the README's dev section are for
contributors and stay separate.

Screenshots are **generated, not hand-taken**. `docs/screenshots/generate.mjs` drives a real
build with Playwright, draws the orange callout rings and labels as DOM overlays, and writes
`docs/screenshots/*.png`. Re-run it after any UI change the docs describe:

```bash
npm run test:e2e:build                     # build main + preload
node node_modules/vite/bin/vite.js --config vite.renderer.config.ts --port 5173 --strictPort &
node docs/screenshots/generate.mjs
```

## Window Configuration

- macOS: hidden title bar with traffic lights at (12, 12)
- Initial: 1400x900, min: 900x600
- DevTools open in dev mode (skipped when `NODE_ENV=test`)
- `TOTONOTE_DB_PATH` env var overrides default DB location (used by tests)
