/**
 * Regenerates every screenshot used in docs/.
 *
 *   node docs/screenshots/generate.mjs
 *
 * Drives a real build of the app with Playwright, builds up a realistic worked
 * example, and captures annotated PNGs into this folder. Annotations are drawn as
 * real DOM overlays before the capture, so they stay crisp and match the app's
 * styling rather than being painted on afterwards.
 *
 * Prerequisites (the same ones the E2E suite needs):
 *   npm run test:e2e:build                      # build main + preload
 *   node node_modules/vite/bin/vite.js --config vite.renderer.config.ts \
 *        --port 5173 --strictPort                # renderer dev server, in another shell
 *
 * Re-run this after any UI change that the docs describe.
 */
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DB = path.join(HERE, '.screenshots.db');

const MARKER = '#ff9f43'; // orange — deliberately absent from the app's own palette

for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const app = await electron.launch({
  args: [path.join(ROOT, '.vite/build/index.js')],
  env: { ...process.env, TOTONOTE_DB_PATH: DB, NODE_ENV: 'test' },
});
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.waitForSelector('.app-container');

await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  w.setSize(1400, 900);
});
await page.waitForTimeout(400);

// ── annotation + capture ──────────────────────────────────────────────────────

/**
 * Draw labelled rings around elements. `place` positions the label, and `bounds` is
 * the region that will actually be captured — labels are kept inside it, otherwise a
 * label placed beside an element lands outside the crop and is lost.
 */
async function mark(specs, bounds) {
  await page.evaluate(
    ({ specs, colour, bounds }) => {
      document.querySelectorAll('.__annot').forEach(e => e.remove());
      for (const spec of specs) {
        const el = spec.nth
          ? document.querySelectorAll(spec.selector)[spec.nth]
          : document.querySelector(spec.selector);
        if (!el) {
          console.warn('[screenshots] no element for', spec.selector);
          continue;
        }
        const r = el.getBoundingClientRect();
        const pad = spec.pad ?? 3;

        const ring = document.createElement('div');
        ring.className = '__annot';
        Object.assign(ring.style, {
          position: 'fixed',
          left: `${r.left - pad}px`,
          top: `${r.top - pad}px`,
          width: `${r.width + pad * 2}px`,
          height: `${r.height + pad * 2}px`,
          border: `2px solid ${colour}`,
          borderRadius: '5px',
          pointerEvents: 'none',
          zIndex: '2147483000',
        });
        document.body.appendChild(ring);

        if (!spec.label) continue;
        const tag = document.createElement('div');
        tag.className = '__annot';
        tag.textContent = spec.label;
        Object.assign(tag.style, {
          position: 'fixed',
          padding: '2px 7px',
          background: colour,
          color: '#1a1a1a',
          font: '600 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
          borderRadius: '3px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: '2147483001',
          boxShadow: '0 2px 6px rgba(0,0,0,.5)',
        });
        document.body.appendChild(tag);

        const tr = tag.getBoundingClientRect();
        const place = spec.place ?? 'above';
        let left = r.left - pad;
        let top = r.top - pad - tr.height - 5;
        if (place === 'below') top = r.top + r.height + pad + 5;
        if (place === 'right') {
          left = r.left + r.width + pad + 6;
          top = r.top + r.height / 2 - tr.height / 2;
        }
        if (place === 'left') {
          left = r.left - pad - tr.width - 6;
          top = r.top + r.height / 2 - tr.height / 2;
        }
        if (place === 'inside') {
          left = r.left + 10;
          top = r.top + r.height - tr.height - 10;
        }
        // keep the label inside whatever region is being captured
        const b = bounds ?? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
        left = Math.max(b.x + 4, Math.min(left, b.x + b.width - tr.width - 4));
        top = Math.max(b.y + 4, Math.min(top, b.y + b.height - tr.height - 4));
        tag.style.left = `${left}px`;
        tag.style.top = `${top}px`;
      }
    },
    { specs, colour: MARKER, bounds },
  );
}

async function clearMarks() {
  await page.evaluate(() => document.querySelectorAll('.__annot').forEach(e => e.remove()));
}

/**
 * Capture. `clip` is a selector to crop to (expanded by `pad`); omit for the full
 * window. Labels that spill outside the crop are pulled back in by `mark`, so crop
 * regions should be generous.
 */
async function shot(name, { marks = [], clip = null, pad = 14 } = {}) {
  // Work out the capture region first, so labels can be kept inside it.
  let clipRect;
  if (clip) {
    const box = await page.locator(clip).first().boundingBox();
    if (!box) throw new Error(`shot("${name}"): no element for clip "${clip}"`);
    const size = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    clipRect = {
      x,
      y,
      width: Math.min(box.width + pad * 2, size.width - x),
      height: Math.min(box.height + pad * 2, size.height - y),
    };
  }

  if (marks.length) await mark(marks, clipRect);
  await page.waitForTimeout(150);

  await page.screenshot({ path: path.join(HERE, `${name}.png`), clip: clipRect });
  await clearMarks();
  console.log(`  ✓ ${name}.png`);
}

// ── helpers for driving the app ───────────────────────────────────────────────

const row = n => page.locator('.category-row', { hasText: n });

async function newCategory(name) {
  await page.locator('.btn', { hasText: '+ New Category' }).click();
  await page.locator('.category-new-form input.input').fill(name);
  await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
  await page.locator('.category-row', { hasText: name }).waitFor();
}

async function newSubCategory(parent, name) {
  await row(parent).locator('.category-row-btn', { hasText: '+' }).click();
  await page.locator('.category-new-form input.input').fill(name);
  await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
  await page.locator('.category-row', { hasText: name }).waitFor();
}

async function newSection(title, abbreviation) {
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal input.input').nth(1).fill(abbreviation);
  await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
  await page.waitForTimeout(250);
}

async function editTab() {
  await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
}

console.log('Generating documentation screenshots…');

// ── 1. Documents screen ───────────────────────────────────────────────────────

await shot('01-documents-screen', {
  marks: [{ selector: '.document-card-new', label: 'Start a new document here', place: 'right' }],
});

await page.locator('.document-card-new').click();
await page.locator('.modal input.input').first().fill('Hololore');
await page.locator('.modal textarea, .modal .textarea').first().fill('Characters, places and history.');
await shot('02-new-document', {
  clip: '.modal',
  pad: 210,
  marks: [
    { selector: '.modal .input-group', nth: 0, label: 'Required', place: 'right' },
    { selector: '.modal .input-group', nth: 1, label: 'Optional — shown on the tile', place: 'right' },
    { selector: '.modal .btn-primary', label: 'Create', place: 'left' },
  ],
});
await page.locator('.modal .btn-primary').click();
await page.waitForSelector('.tab-bar');

// ── 2. Sections ───────────────────────────────────────────────────────────────

await page.locator('.tab-add').click();
await page.locator('.modal input.input').first().fill('Ancient Age');
await page.locator('.modal input.input').nth(1).fill('ANC');
await shot('03-new-section', {
  clip: '.modal',
  pad: 210,
  marks: [
    { selector: '.modal .input-group', nth: 0, label: 'Required', place: 'right' },
    {
      selector: '.modal .input-group',
      nth: 1,
      label: 'Short label for the tab — check this before creating',
      place: 'right',
    },
  ],
});
await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
await page.waitForTimeout(300);

await newSection('Modern Era', 'MOD');
await newSection('Characters', 'CHR');

const editor = page.locator('.tiptap').first();
await editor.click();
await editor.pressSequentially(
  'Gura arrived from the deep and quickly became one of the most recognised figures of the age.',
  { delay: 8 },
);
await page.waitForTimeout(1400); // let the autosave land so the status bar reads "Saved"

await shot('04-app-layout', {
  marks: [
    { selector: '.left-sidebar', label: '1  Browse — search, filter, highlights', place: 'inside' },
    { selector: '.editor-area', label: '2  Your writing, all sections on one page', place: 'inside' },
    { selector: '.right-sidebar', label: '3  Details — Info / Arrange / Edit', place: 'inside' },
  ],
});

await shot('04b-toolbar', {
  clip: '.main-toolbar',
  pad: 26,
  marks: [
    { selector: '.toolbar-back-btn', label: 'Back to your documents', place: 'below' },
    { selector: '.toolbar-group', nth: 1, label: 'Headings', place: 'below' },
    { selector: '.toolbar-btn[title=\"Settings\"]', label: 'Settings', place: 'below' },
  ],
});

await shot('05-section-tabs', {
  clip: '.tab-bar',
  pad: 10,
  marks: [
    { selector: '.section-tab', nth: 0, label: 'Active tab — full title', place: 'below' },
    { selector: '.section-tab', nth: 1, label: 'Others show the abbreviation', place: 'below' },
    { selector: '.tab-add', label: 'Add a section', place: 'left' },
  ],
});

await shot('06-status-bar', {
  clip: '.status-bar',
  pad: 10,
  marks: [
    { selector: '.status-bar', label: 'Saved automatically ~1s after you stop typing', place: 'above' },
  ],
});

// ── 3. Categories and rules ───────────────────────────────────────────────────

await editTab();
await newCategory('CHARACTERS');

await shot('07-edit-tab', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [
    { selector: '.category-row', nth: 1, label: 'A category — click the name to rename it', place: 'left' },
    { selector: '.category-row-btn', nth: 2, label: 'Adds a sub-category inside it', place: 'below' },
  ],
});

await row('CHARACTERS').click({ button: 'right' });
await shot('08-category-menu', {
  clip: '.context-menu',
  pad: 30,
  marks: [
    { selector: '.context-menu-item', nth: 1, label: 'Set up a rule here', place: 'right' },
  ],
});

await page.locator('.context-menu-item', { hasText: 'Create rule…' }).click();
await page.locator('.modal .rule-textarea').fill('HISTORY\nABILITIES\n  COMBAT\n  MAGIC\nCOLOUR PALETTE');
await page.waitForTimeout(250);
await shot('09-rule-editor', {
  clip: '.modal',
  pad: 210,
  marks: [
    { selector: '.rule-textarea', label: 'One name per line — indent to nest', place: 'right' },
    { selector: '.rule-preview', label: 'Exactly what you will get', place: 'right' },
    { selector: '.modal-footer .btn-primary', label: 'Save the rule', place: 'above' },
  ],
});
await page.locator('.modal .btn-primary', { hasText: 'Save' }).click();
await page.waitForTimeout(300);

await shot('10-rule-badge', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [
    {
      selector: '.rule-chip',
      label: 'Rule set — creates 5 sub-categories. Click to edit.',
      place: 'below',
    },
  ],
});

await row('CHARACTERS').locator('.category-row-btn', { hasText: '+' }).click();
await page.locator('.category-new-form input.input').fill('GURA');
await page.waitForTimeout(200);
await shot('11-apply-rule-checkbox', {
  clip: '.category-new-form',
  pad: 30,
  marks: [
    { selector: '.rule-checkbox', label: 'Leave ticked to use the rule', place: 'below' },
  ],
});
await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
await page.waitForTimeout(300);

await newSubCategory('CHARACTERS', 'PEKORA');
await page.waitForTimeout(300);

await shot('12-rule-result', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [
    { selector: '.category-row', nth: 2, label: 'You typed this…', place: 'left' },
    { selector: '.category-row', nth: 3, label: '…these appeared', place: 'left' },
  ],
});

// Select mode / bulk add
await newCategory('LOCATIONS');
await page.locator('.btn', { hasText: 'Select' }).click();
await row('CHARACTERS').locator('.category-select-box').check();
await row('LOCATIONS').locator('.category-select-box').check();
await page.locator('.right-sidebar .sidebar-content').evaluate(el => { el.scrollTop = 0; });
await page.waitForTimeout(200);
await shot('13-select-mode', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [
    { selector: '.category-select-bar', label: 'Add one sub-category to every ticked category', place: 'left' },
  ],
});

await page.locator('.btn', { hasText: 'Add sub-category…' }).click();
await page.locator('.modal input.input').fill('NOTES');
await shot('14-bulk-add', { clip: '.modal' });
await page.locator('.modal .btn-primary', { hasText: 'Add' }).click();
await page.waitForTimeout(300);
// Adding in bulk leaves Select mode on its own, so there is no Done button to press.

// ── 4. Tags and annotations ───────────────────────────────────────────────────

await page.locator('.btn', { hasText: '+ New Tag' }).click();
await page.locator('.modal input.input').first().fill('Gura');
await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
await page.waitForTimeout(300);

// Select just the word "Gura" — driven from the keyboard so ProseMirror's own
// selection handling fires and the floating toolbar actually appears.
await editor.click();
await page.keyboard.press('Meta+A');
await page.keyboard.press('ArrowLeft');
for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
await page.waitForTimeout(500);

if (await page.locator('.selection-toolbar').count()) {
  await shot('15-selection-toolbar', {
    clip: '.selection-toolbar',
    pad: 40,
    marks: [
      { selector: '.selection-toolbar-btn', nth: 0, label: 'Tag the selected words', place: 'above' },
    ],
  });

  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  await page.waitForTimeout(300);
  await shot('16-add-tag', {
    clip: '.modal',
    pad: 60,
    marks: [
      { selector: '.autocomplete', label: 'Search, or create a new tag', place: 'below' },
    ],
  });
  const option = page.locator('.autocomplete-item', { hasText: 'Gura' }).first();
  if (await option.count()) {
    await option.click();
    await page.waitForTimeout(700);
    if (await page.locator('.annotation-highlight').count()) {
      await shot('17-annotation', {
        clip: '.tiptap',
        pad: 20,
        marks: [
          { selector: '.annotation-highlight', label: 'Tagged text', place: 'below' },
        ],
      });
    }
  } else {
    await page.keyboard.press('Escape');
  }
} else {
  console.warn('  ! selection toolbar did not appear — skipping annotation shots');
}

// Section tag bar
await shot('18-section-tag-bar', {
  clip: '.section-tag-bar',
  pad: 40,
  marks: [
    { selector: '.section-tag-add-btn', label: 'Tag the whole section', place: 'right' },
  ],
});

// ── 5. Browse sidebar ─────────────────────────────────────────────────────────

await shot('19-browse-modes', {
  clip: '.sidebar-mode-bar',
  pad: 30,
  marks: [
    { selector: '.sidebar-mode-btn', nth: 0, label: 'Find', place: 'below' },
    { selector: '.sidebar-mode-btn', nth: 2, label: 'Filter', place: 'below' },
    { selector: '.sidebar-mode-btn', nth: 3, label: 'Highlights', place: 'below' },
  ],
});

await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();
await page.waitForTimeout(300);
await shot('20-filter-mode', { clip: '.left-sidebar' });

await page.locator('.sidebar-mode-btn', { hasText: 'HL' }).click();
await page.waitForTimeout(300);
await shot('21-highlight-mode', {
  clip: '.left-sidebar',
  pad: 300,
  marks: [
    { selector: '.sidebar-highlight-toggle', label: 'Turn every highlight on or off', place: 'below' },
  ],
});

await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
await page.waitForTimeout(300);

// ── 6. Arrange tab and Settings ───────────────────────────────────────────────

await page.locator('.sidebar-tab', { hasText: 'Arrange' }).click();
await page.waitForTimeout(300);
await shot('22-arrange-tab', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [
    { selector: '.input-group', nth: 0, label: 'What this document calls its sections', place: 'below' },
  ],
});

await page.locator('.toolbar-btn[title="Settings"]').click();
await page.waitForTimeout(400);
await shot('23-settings', {
  clip: '.modal',
  pad: 150,
  marks: [{ selector: '.theme-grid', label: 'Four themes', place: 'right' }],
});
await page.locator('.modal .btn-primary', { hasText: 'Done' }).click();

console.log('\nDone. Screenshots written to docs/screenshots/');
await app.close();

for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
