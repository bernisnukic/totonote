# TotoNote - Contributor Guide

## What This Is

Electron desktop app for organizing lore/world-building notes. Rich text editor with annotation/tagging, section-based navigation, category browsing, and metadata management. Single-user, local-first, dark retro/terminal aesthetic.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Shell | Electron Forge + Vite |
| Frontend | React 19 + TypeScript |
| Editor | TipTap 3 (ProseMirror) |
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
- **annotation-slice**: annotations, highlight visibility, per-tag hidden highlights, placements
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

**Map the decoration set; don't rebuild it from positions.** The two kinds of decoration
survive a change differently, and the plugin has to do both. An *inline* decoration is
carried by `DecorationSet.map`, which is also what enforces `inclusiveEnd: false` — the rule
that typing after a highlight starts a fresh, untagged run. A *node* decoration (pictures
and drawings, which have no text to wrap) is **dropped as soon as its node is replaced**, and
`updateAttributes` replaces the node — so resizing a tagged drawing lost its highlight until
something re-synced. The plugin therefore keeps the annotations, maps the set, and rebuilds
only the node decorations, which are tagged `spec.isNodeHighlight` so they can be picked out.

Re-deriving inline decorations from mapped positions instead looks equivalent and is not:
`tr.mapping.map(pos)` defaults to associating **right**, so an insertion at a highlight's end
pushes the end along and the highlight swallows what you just typed. The end needs
`map(pos, -1)`. `tags.spec.ts` ("typing after a highlight does not extend it") catches it.

### Filing & the Graph
Annotations optionally carry a **filing** (`annotations.category_id` + `placement_order`): the
category page the excerpt belongs to, independent of its tag. Compiled "wiki pages"
(`CategoryPage.tsx`, plus the tag view in `InfoPanel.tsx`) list filed excerpts across **all**
documents; excerpt text is computed **in the main process** from stored TipTap JSON by
`src/shared/prosemirror-text.ts`, which replicates ProseMirror position arithmetic (containers
cost 1 to enter/leave, text is 1/char, hard breaks are 1). Server excerpts trail the debounced
save by ≤1s, so `PlacementRow` falls back to live editor text for open sections. Filing a
category deleted → `ON DELETE SET NULL` (unfiles, never deletes) — note drizzle-kit dropped
that clause from the generated 0002 ALTER and it was restored by hand; `migration.test.ts`
guards it. `GraphView.tsx` (toolbar ◈) draws categories/tags/filings with a hand-rolled force
layout — no graph library.

### Links, Timeline and Backup
`[[Document]]` links are an **inline atom node** (`extensions/document-link/`), not a mark —
one indivisible clickable thing costing exactly 1 position. `shared/doc-links.ts` finds them
in stored JSON (main answers "what links here?" via `listBacklinks`; the renderer renders
them). Links store `documentId`, so a rename updates every link with no rewrite; `label` is
only the fallback for a deleted target. The `[[` picker is hand-rolled — no
`@tiptap/suggestion` dependency — with the trigger rule isolated in `lib/link-trigger.ts`.

The **timeline** reads `annotations.when_text`, free text because a world's calendar isn't
ours. `shared/when.ts` extracts a sort key (ISO date, written-out date, or the first signed
number) and returns null for text with no number, which groups under "Undated" rather than
being guessed at. SQL can't order "Year 300 of the Third Age" against "1885-03-12", so
`listTimeline()` returns unordered rows and the renderer sorts.

**Backup** (`main/services/backup.ts`) is `better-sqlite3`'s online backup, not a file copy —
measured: copying `totonote.db` alone while WAL holds recent writes yields *"no such table:
documents"*. Restore validates first (required tables + not from a newer schema), keeps the
replaced DB as `<db>.replaced`, clears the `-wal`/`-shm` sidecars, then relaunches.

### Styling
Tokens live in `styles/tokens.css` and are named `--font-size-*`, `--border-default`,
`--radius-*`, `--space-*`. A misspelt custom property is **silent** — the declaration is
dropped, the element falls back to a browser default, and nothing warns. Fourteen shipped at
once (`--font-xs`, `--border-color`). `styles/tokens.test.ts` walks every CSS file and fails
on any `var(--x)` that resolves to nothing, ignoring those with a fallback.

Toolbar glyphs are **drawn**, in `toolbar-icons.tsx` — 16px inline SVG on `currentColor`. Do
not mix HTML entities in beside them: the right-hand group was `&#9672;`/`&#9881;` and
rendered visibly smaller than its neighbours, which is what the tester reported.

### History memory
The History timeline is **session-only** — it lives in `history-slice.ts` and is never
written to the database, so it costs no disk at all. It is capped at `MAX_SNAPSHOTS = 60`
*per section*, and every section of an open document is mounted at once, so the cost is
per-section and released by `clearSectionHistory` / `leaveDocument`.

Each checkpoint holds a full copy of the section's JSON. Measured at the 60-checkpoint cap:
0.1 MB for a short section, 0.9 MB for a long one (12k chars), 3.5 MB for a very long one.

The trap is **drawings**: `DrawingHandle.read()` re-serialises the canvas on every call, so
a checkpoint taken while merely typing used to store another complete copy of an untouched
drawing — 10.2 MB for a 120-stroke drawing, against 0.4 MB now that
`shareUnchangedStrokes()` reuses the previous checkpoint's object when the strokes are
identical. Anything else that snapshots re-serialised state needs the same treatment; the
test asserts *reference* identity, because an equal-but-fresh string looks the same and
costs 60x.

### The splash window
`main/services/splash.ts` creates a **separate frameless BrowserWindow** and the main window
is constructed with `show: !splashWanted`; `runSplash()` closes the splash and shows the main
window once *both* one play-through has elapsed and `ready-to-show` has fired, with a 12s
backstop. It was previously an in-app React overlay, which meant the main window was visible
behind it — not a splash screen. The splash has **no preload and no IPC**: the version
arrives on the query string, because a splash that can fail is worse than no splash.

`assets/splash/` ships via `extraResource` and `findSplashFile()` probes dev/packaged
candidates, the same shape as `findMigrationsFolder()`. `scripts/verify-package.mjs` fails
the build if it did not get copied — without that check a packaged build silently never
shows a splash. Automation (`NODE_ENV=test`) skips it entirely, so it never sits in front of
the E2E suite; `e2e/startup.spec.ts` therefore launches its own instances *without* that env
var and observes windows through `app.evaluate`, since the splash has no DOM the driver can
reach.

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
12. **Playwright can't select the indented `<option>`s by label** — category dropdowns indent nested options with non-breaking spaces (`optionIndent`), and `selectOption({ label })` fails to match through them. Resolve the value first: `locator('option', { hasText: name }).getAttribute('value')`, then `selectOption(value)`.
13. **Two annotations over the identical range render as ONE `.annotation-highlight` span** — ProseMirror merges coinciding inline decorations, so E2E assertions counting spans must put overlapping tags on different ranges (or different sections) to observe them separately.
14. **Databases from v1.0.4 and earlier need adopting** — they track migrations in `_migrations`, not `__drizzle_migrations`, so the migrator would re-run `0000_initial` and crash on "table already exists". `src/main/db/legacy-baseline.ts` rebuilds `categories` (its inline `UNIQUE` is an implicit autoindex that cannot be dropped) and records 0000 as applied, before `migrate()` runs.
15. **Never give the Edit menu `role: 'undo'`/`'redo'`** — those fire the OS-native undo, which a ProseMirror editor doesn't hear, so Cmd+Z silently does nothing while typing. `menu.ts` sends `menu:undo`/`menu:redo` instead, and `AppLayout` routes them to the focused editor's history (or `execCommand` for a plain input). The same applies to any editor command you'd expect a menu role to cover.
16. **Every inline atom must be in `LEAF_NODES`** (`shared/prosemirror-text.ts`). Miss one and every highlight *after* it reads back one position short, so wiki excerpts silently show the wrong words — the same class of bug as the history-restore corruption. `doc-links.test.ts` guards it: remove `DOCUMENT_LINK_NODE` from the set and 3 tests fail.
17. **Excerpts computed in main trail the debounced save by ≤1s.** Anything rendering an excerpt must go through `renderer/lib/excerpt-text.ts`, which falls back to the live editor. The timeline shipped without it and showed "(no text)" for anything just dated.
18. **`window.confirm`/`alert` are banned in the renderer** — use `confirmDialog`/`alertDialog` (`components/common/ConfirmDialog.tsx`), mounted once as `ConfirmDialogHost` in `App.tsx`. E2E: the `page.once('dialog', …)` pattern no longer applies; use `acceptConfirm(page)` / `dismissConfirmIfShown(page)` from `e2e/fixtures.ts`, called *after* triggering the action.
19. **A full-window overlay must start at `var(--title-bar-height)`, not `inset: 0`** — otherwise its heading sits under the macOS traffic lights in windowed mode. `.graph-overlay`, `.help-overlay`, `.wiki-overlay` and `.timeline-overlay` all do; the timeline shipped without it. The check in `app-shell.spec.ts` loops over every overlay, so add new ones to that list.
20. **Clickable `<div>`/`<span>` must spread `lib/clickable.ts`**, which adds `role="button"`, `tabIndex` and Enter/Space handling. A div with a bare `onClick` cannot be reached by keyboard at all.
21. **Manual-save mode: saving a section needs the live editor, not just the store.** Annotation positions are mapped through edits and only the editor knows the current ones, so each `SectionEditor` registers a flusher in `lib/save-registry.ts`; `saveAllDirty()` calls those (content + positions). Warn-on-exit is a main↔renderer handshake: the renderer pushes `window:set-dirty`, the window `close` handler shows the dialog, and "Save" → `app:save-and-quit` → flush → `app:force-quit`.
22. **Anything that unmounts the section editors must call `leaveDocument()` first.** A flusher only works while its editor is mounted, so tearing the editors down without flushing silently destroys unsaved work — that shipped once, via `closeDocument`. `leaveDocument()` (document-slice) flushes dirty sections *and* drops the session History for them; `closeDocument`, `openDocument` (when switching) and `setActiveWorkspace` all go through it. `deleteDocument` deliberately doesn't flush, but still clears the dirty ids and history so a deleted document can't leave the app marked unsaved. `document-slice.test.ts` guards all of this.
23. **The renderer↔main surface is allowlisted in both directions.** `preload.ts` rejects any channel not in `IPC_CHANNELS` (invoke) or `MENU_CHANNELS` (push). `IPC_CHANNELS` is a runtime array in `shared/ipc-types.ts` kept in step with `IpcHandlerMap` by two type assertions — add a channel to one and forget the other and the build fails.
24. **CI gates the release.** `.github/workflows/build.yml` runs lint + unit + E2E first; `build` and `release` only run for a `v*` tag and only after that job passes. Keep `npm run lint` at **zero errors** or nothing can ship (warnings are fine).
25. **An invisible control still catches clicks.** `opacity: 0` hides a thing without excusing it from hit-testing, so a hover-revealed control silently eats every click aimed at what is underneath. The resize handles shipped this way: 14px, straddling the bottom-right corner and overlapping by ~9px, which on an icon-sized picture covered the lot — clicking it did nothing whatsoever. Hidden must also mean `pointer-events: none`. Note that gating on `:hover` alone cannot fix an overlap, because hovering is exactly what reveals the control (and Playwright hovers in order to click); when a control can cover its own target, it has to *move* — `.is-small` puts the handle clear of the corner. `MIN_WIDTH` only constrains dragging, so an image that arrives small was never covered by it.
26. **A slow E2E suite is usually a failing one.** Nine tests each burning a 30s timeout, twice with retries, is nine minutes — enough to look exactly like a global slowdown and send you hunting Chromium throttling flags. Check the failure count and read one actual error before theorising about performance; the totals not reconciling (159 passed of 168 defined) is the tell.

## Documentation

End-user docs live in `docs/` as markdown, so the same files render on GitHub and can be
bundled into an in-app help panel later. `CONTRIBUTING.md` and the README's dev section are for
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
