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

// ── 0. The splash window ──────────────────────────────────────────────────────
// A separate window with no preload, so it cannot be annotated the way the others are —
// captured as-is, which is all it needs.
{
  const splashDb = path.join(HERE, '.splash.db');
  for (const f of [splashDb, `${splashDb}-wal`, `${splashDb}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  const splashApp = await electron.launch({
    args: [path.join(ROOT, '.vite/build/index.js')],
    // Deliberately *not* NODE_ENV=test: that is what suppresses the splash.
    env: { ...process.env, TOTONOTE_DB_PATH: splashDb },
  });
  await new Promise(r => setTimeout(r, 2000));
  const splashPage = splashApp.windows().find(w => w.url().includes('splash.html'));
  if (splashPage) {
    // Unpackaged, app.getVersion() reports Electron's version rather than TotoNote's, so
    // the shot would show something no user ever sees. Put the real one in.
    const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    await splashPage.evaluate(v => {
      const el = document.getElementById('version');
      if (el) el.textContent = `Version ${v}`;
    }, version);
    await splashPage.screenshot({ path: path.join(HERE, '40-splash.png') });
    console.log('  ✓ 40-splash.png');
  } else {
    console.warn('  ! splash window not found — skipping 40-splash.png');
  }
  await splashApp.close();
  for (const f of [splashDb, `${splashDb}-wal`, `${splashDb}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

// ── 1. Documents screen ───────────────────────────────────────────────────────

await shot('01-documents-screen', {
  marks: [{ selector: '.document-card-new', label: 'Start a new document here', place: 'right' }],
});

await shot('27-workspace-bar', {
  clip: '.workspace-bar',
  pad: 40,
  marks: [
    { selector: '.workspace-bar__current', label: 'Click to switch, rename or add a world', place: 'below' },
  ],
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
    { selector: '.toolbar-btn[aria-label=\"Settings\"]', label: 'Settings', place: 'below' },
  ],
});

await shot('05-section-tabs', {
  clip: '.tab-bar',
  pad: 10,
  marks: [
    { selector: '.section-tab', nth: 0, label: 'The section you are in', place: 'below' },
    { selector: '.section-tab', nth: 1, label: 'Click to jump to a section', place: 'below' },
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

// ── 4b. Filing and the graph ──────────────────────────────────────────────────

// The Add Tag modal, with the create button and File under dropdown.
await editor.click();
await page.keyboard.press('Escape');
await page.keyboard.press('Meta+A');
await page.waitForTimeout(300);
await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click({ force: true });
await page.waitForTimeout(250);
await shot('24-file-under', {
  clip: '.modal',
  pad: 210,
  marks: [
    { selector: '.create-tag-btn', label: 'Brand-new tag', place: 'right' },
    { selector: '.modal .input-group', label: 'Optional — put it on a page too', place: 'right' },
    { selector: '.autocomplete', label: 'Pick the tag', place: 'right' },
  ],
});
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// File the existing highlight under GURA > HISTORY, then show GURA's compiled page.
await page.locator('.annotation-highlight').first().click({ button: 'right' });
await page.locator('.context-menu-item', { hasText: 'File under…' }).click();
const fileModal = page.locator('.modal', { hasText: 'File under' });
const histVal = await fileModal.locator('select.input option', { hasText: 'HISTORY' }).first().getAttribute('value');
await fileModal.locator('select.input').selectOption(histVal);
await fileModal.locator('.btn-primary', { hasText: 'Save' }).click();
await page.waitForTimeout(400);

await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
await page.locator('.category-name-link', { hasText: 'GURA' }).first().click();
await page.waitForTimeout(500);
await shot('25-category-page', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [
    { selector: '.placement-sort-bar', label: 'Order the page your way', place: 'left' },
    { selector: '.placement-row', label: 'Filed excerpt — click to jump to it', place: 'left' },
  ],
});
await page.keyboard.press('Escape');

// The graph.
await page.locator('.toolbar-btn[aria-label="Graph view"]').click();
await page.waitForTimeout(4500);
await shot('26-graph', {
  marks: [
    { selector: '.graph-node-tag', label: 'A tag — click to open its page', place: 'right' },
  ],
});
await page.keyboard.press('Escape');
await page.waitForTimeout(300);


// ── Embedded image ────────────────────────────────────────────────────────────

// A real PNG pasted the way a user would, into the empty MODERN ERA section so nothing
// existing gets split. Small enough to inline here; the pipeline is the genuine one.
await page.locator('.tiptap').nth(1).click();
await page.evaluate(async b64 => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const file = new File([bytes], 'gura-reference.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  document
    .querySelectorAll('.tiptap')[1]
    ?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, 'iVBORw0KGgoAAAANSUhEUgAAAWgAAADwCAIAAACixWkYAAAG/klEQVR42u3dyXZVRRiG4RrT9z32DX3f94HQ96AoiqIoiqIoioIoinMvzHvQsWPnTgwrEkM4JKcqZ++zd9Wz1nMD+/sr7yiQMGXRCoAowQSAcAB1hGMlQJQwZfFKgCjCAaSEYxVAFOEAEsKxZDVAFOEAhAOoJRxrAKKEqUvXAEQRDiAlHGsBoggHkBCOZesAoggHIBxALeFYDxAlTF2+HiCKcAAp4dgAEEU4gPhwTHtuI0AU4QCEA6glHJsAooRpz28CiCIcQEo4NgNEEQ4gIRwvbAGIIhyAcAC1hGMrQJQw/cWtAFGEA0gJxzaAKMIBJITjpe200W9//v00s1AP4cinGtqBcJBSDe2gtnDsoF26CIeVqFaY/vIO2mXicFiJigmHcEBKOHbSLl2Ew0pUSziEA+LDMeOVXbTLhOEwEVUTjtzaYRyEg7h2mIXawrEbIEqY8epugCjCAaSEYw9AFOEAEsLx2l6AKMIBCAdQSzj2FW6838IsfhzoKMx8fV+xJvxHH8NKngg6CqqhHZAQjv0FiqrG43bsB4YF1dAOiA/HigNFSa7Gf+0obC7oSDiEA4SjympoB4yEY6AcPQrHABQuzFw5UI7ehKOkxaAj4RAOSAnHwXL0KBwHoXDCIRwQH45Zqw6VoyfhKGox6Eg4MgnHsT/+oUt+7IVDOIRDNfoTjsGiTLoaDf0uReg6HINMXpi1erAokw1Hgz9NFCauRmGvvTqhwG/OshrCoRo1h+NwgZKq0fSPkoaJwnGYXgnFfnlm1RAO1ag3HGuOFKvbarTniwTimeEo+J1XIZggj2QIh2oIB8KhGk0Px1GyIROdwuFh9F6YvfYoOVGK0byHigiHcAgHKeE4Rk7EYlQ1vIeqCIdwqAYJ4Vh3nMyoxqNweAlVEg7hUA2EA+EQjlrCcYLMFF8Nb6ByYfb6E+Sn3Gq4fi2EQziEg5RwnCQ/pVbD6WsiHMIhHMSHY86GU+SnwGo4ep2EQztUA+FAOKglHKfJUknVcO66hTkbT5OlgsLh3LUTDu1QDVLCcYZcFVCNfs47zn9znf3TEg7hEI4eV6OEdoQ5m86Sq8yr0b9hu/yLPBk/LeHQDuGopBp5t0M4hEM1qqpGxu0YCsc5MpZpNfq2Z1I4MnxXYe7mc2Qsy3D0cc+EcGT5roRDO1RDOFLCcZ68ZReOfo6ZFI4MH5VwCIdqCEdCOLZcIG/5VKMBY6aEI8dHJRzaIRzCIRxkGo6GLCkcI+G4SPayCEdTxoysRp4vKszdepHstb4aDduz22rk+6KEQztUo5J25P2chsLxBiVoczgaOum41cj8OQmHcKgG8eGYt+1NStDScDhcMwmHcKgGwkEu7XCvhofjEoVoWzicrLnCvO2XKESbquFezSYcwiEcpITjLcrRkmq4VNMJh3CoBgnh2PE25WhBOJypDYRDOFQD4aDN7XCdFoXjMkVpcDVcpzXC/J2XKUozq+Eu7SIcwiEcpITjHUrTvGo4SssIh3AIBwnh2PUupWlWNVykhYRDOFQD4aBV7XCI9objCgVqRjUcoq3C/N1XKFAjwuEQrSUcwqEapITjPcrU12rYv92EQziEg/hwLNjzPmXqVzUsnwHhEA7hQDhodjjMnk04rlKs2qth80yEBXuvUqy6w2HzXAiHcKgGKeH4gGLVGw6D50M4tEM1SAjHvg8pWR3VsHN2hEM4hAPhoGHhsHCu4bhG4SoOh4UzFBbuv0bhqquGbXMlHFxTDRLC8RGFqywcts2WcFBJO0yaezgOfAy9D4dVsyYc9D4c9hQOhEM16BCO6zCkd+EwZv7CwoHrMKQ31bBkGYQD4SAlHJ/AkF5Uw4ylEA560w7rlRWORQc/hWGTCYf1iiIc9CAcphMOhEM4mDgcN2BYajVMV5yw6NANGBFdDaMVSTgQDlLC8RmMiKyGxQolHAgHCeEY/BxG67YatiqYcJASDisJhxUQDqLDcRNG66IaVipdWHz4Jowxfjjsg3AQFw7jMByOL2CMZ1fDODwiHAgHCeE48iU8rUM1zMJjwoFwIBxUEw6DMCYct+BpT1bDIDwhLD56Czr6PxzW4EnCwQThsAMdw/EVdPQ4HKZgrHDv97+go6FqGIGOhAMQDqCGcCw59jVAlKFw3AaIEpYcvw0QRTiAlHB8AxBFOICEcJz4FiCKcADCAdQSjjsAUcLSk3cAoggHkBKO7wCiCAeQEI5T3wNEEQ5AOIBawnEXIEpYevouQBThAFLCcQ8ginAA8eFYduYHgCjCAQgHUEs47gNECcvO3geIIhxASjh+BIgiHEBCOM79BBBFOADhAGoJxwOAKGH5+QcAUYQDSAnHzwBRhANICMeFXwCiCAcgHEAt4XgIECUsv/gQIIpwACnh+BUginAA0f4FUXBzhARKYT4AAAAASUVORK5CYII=');
await page.waitForSelector('.tiptap img', { timeout: 10000 });
// Pasting leaves the image node selected, which floats the Tag toolbar over it.
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(600);
await page.locator('.section-tab', { hasText: 'MOD' }).click();
await page.waitForTimeout(700);
await shot('31-images', {
  clip: '.editor-area',
  marks: [{ selector: '.tiptap img', label: 'Pasted in — kept inside your world file', place: 'right' }],
});


// ── Drawing over an image ─────────────────────────────────────────────────────

// Paste into the third (empty) section and draw on it while it is still selected — the
// same path a user takes, and the moment the toolbar offers "Draw on this image".
// Make CHARACTERS the active section first: the toolbar reads the *active* section's
// editor, so pasting into a different one leaves it offering a blank drawing instead.
await page.locator('.section-tab', { hasText: 'Characters' }).click();
await page.waitForTimeout(800);
await page.locator('.tiptap').nth(2).click();
await page.waitForTimeout(300);
await page.evaluate(async b64 => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const file = new File([bytes], 'map.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  document
    .querySelectorAll('.tiptap')[2]
    ?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, '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');
await page.waitForTimeout(900);
await page.locator('.toolbar-btn[aria-label="Draw on this image"]').click();
await page.waitForSelector('.drawing-node', { timeout: 10000 });
await page.locator('.drawing-node .btn', { hasText: 'Draw' }).click();
await page.waitForTimeout(300);

// A ring around something and an arrow pointing at it — the marking-up case.
await page.evaluate(() => {
  const canvas = document.querySelector('.drawing-canvas__live');
  const r = canvas.getBoundingClientRect();
  canvas.setPointerCapture = () => undefined;
  canvas.hasPointerCapture = () => true;
  canvas.releasePointerCapture = () => undefined;
  const send = (type, fx, fy, pressure, id) =>
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
      clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, pressure }));

  send('pointerdown', 0.66, 0.30, 0.7, 1);
  for (let i = 1; i <= 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    send('pointermove', 0.60 + Math.cos(a) * 0.11, 0.52 + Math.sin(a) * 0.22, 0.7, 1);
  }
  send('pointerup', 0.71, 0.52, 0, 1);

  // Shaft, then back down one barb and out the other — a proper arrowhead.
  send('pointerdown', 0.16, 0.84, 0.9, 2);
  send('pointermove', 0.30, 0.75, 0.9, 2);
  send('pointerup', 0.44, 0.66, 0, 2);
  send('pointerdown', 0.44, 0.66, 0.9, 3);
  send('pointermove', 0.36, 0.665, 0.9, 3);
  send('pointerup', 0.36, 0.665, 0, 3);
  send('pointerdown', 0.44, 0.66, 0.9, 4);
  send('pointermove', 0.435, 0.745, 0.9, 4);
  send('pointerup', 0.435, 0.745, 0, 4);
});
// The paste left the image selected, which floats the Tag toolbar over the picture.
// Placing a caret in another section clears it; then come back to the drawing.
// (The drawing stays in edit mode across the switch, so the tools are still showing.)
await page.locator('.tiptap').nth(0).click();
await page.waitForTimeout(400);
await page.locator('.section-tab', { hasText: 'Characters' }).click();
await page.mouse.move(20, 20);
await page.waitForTimeout(900);
await shot('32-drawing', {
  clip: '.drawing-node',
  pad: 24,
  marks: [{ selector: '.drawing-toolbar', label: 'Pen, highlighter, eraser', place: 'below' }],
});
await page.locator('.drawing-node .btn', { hasText: 'Done' }).click();
await page.waitForTimeout(200);

// ── 5. Browse sidebar ─────────────────────────────────────────────────────────

await shot('19-browse-modes', {
  clip: '.sidebar-mode-bar',
  pad: 30,
  // The four buttons print their own names (SEARCH SORT FILTER HIGHLIGHTS), so one
  // callout on the whole bar is clearer than four colliding labels under narrow buttons.
  marks: [{ selector: '.sidebar-mode-bar', label: 'Four ways to browse your writing', place: 'below' }],
});

await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();
await page.waitForTimeout(300);
await shot('20-filter-mode', { clip: '.left-sidebar' });

// Filtered reading view: tick a tag, capture the main page showing only its excerpts.
const firstFilter = page.locator('.sidebar-filter-item input[type="checkbox"]').first();
if (await firstFilter.count()) await firstFilter.check().catch(() => {});
await page.waitForTimeout(500);
if (await page.locator('.filtered-view').count()) {
  await shot('28-filtered-view', {
    clip: '.editor-area',
    marks: [
      { selector: '.filtered-excerpt', nth: 0, label: 'Only the tagged text, untagged hidden', place: 'below' },
    ],
  });
  await page.locator('.filtered-view__bar .btn').click().catch(() => {});
  await page.waitForTimeout(200);
}

// Sort view: every tagged excerpt in the document, ordered. No ticking needed — opening
// the Sort tab is enough.
await page.locator('.sidebar-mode-btn', { hasText: 'Sort' }).click();
await page.waitForTimeout(500);
if (await page.locator('.filtered-view').count()) {
  await shot('29-sort-view', {
    clip: '.editor-area',
    // Anchor on the excerpt row, not the bar — a bar callout lands on top of the first
    // section heading right beneath it. Below the row there's open space.
    marks: [
      { selector: '.filtered-excerpt', nth: 0, label: 'Every tagged excerpt, in the order you pick', place: 'below' },
    ],
  });
}

await page.locator('.sidebar-mode-btn', { hasText: 'Highlights' }).click();
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


// Searching the writing itself.
await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
await page.waitForTimeout(300);
await page.locator('.sidebar-search-input').fill('recognised');
await page.waitForTimeout(900);
await shot('33-search', {
  clip: '.left-sidebar',
  pad: 300,
  marks: [{ selector: '.sidebar-writing-results', label: 'Matches from your writing', place: 'right' }],
});
await page.locator('.sidebar-search-input').fill('');
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

// History tab: make a couple of checkpoints (the snapshot debounce is 1200ms), then shoot.
const historyEditor = page.locator('.tiptap').first();
await historyEditor.click();
await historyEditor.pressSequentially(' A first revision of the passage.', { delay: 8 });
await page.waitForTimeout(1400);
await historyEditor.pressSequentially(' Then a second pass, with more detail.', { delay: 8 });
await page.waitForTimeout(1400);
await page.locator('.sidebar-tab', { hasText: 'History' }).click();
await page.waitForTimeout(300);
await shot('30-history', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [
    { selector: '.history-item', nth: 1, label: 'Click a checkpoint to roll back to it', place: 'left' },
  ],
});
await page.locator('.sidebar-tab', { hasText: 'Info' }).click();

// ── 7. Links between documents ────────────────────────────────────────────────

// A second document, so there is something to link to.
await page.locator('.toolbar-back-btn').click();
await page.waitForSelector('.document-card-new');
await page.locator('.document-card-new').click();
await page.locator('.modal input.input').first().fill('Atlantis');
await page.locator('.modal .btn-primary').click();
await page.waitForSelector('.tab-bar');
await newSection('Overview', 'OVR');
const atlantisEditor = page.locator('.tiptap').first();
await atlantisEditor.click();
await atlantisEditor.pressSequentially('A drowned city beneath the northern sea.', { delay: 8 });
await page.waitForTimeout(1400);

// Back into Hololore, and start a link.
await page.locator('.toolbar-back-btn').click();
await page.locator('.document-card', { hasText: 'Hololore' }).first().click();
await page.waitForSelector('.tiptap');
const linkEditor = page.locator('.tiptap').first();
await linkEditor.click();
// A fresh paragraph, so the picker opens near the left margin instead of being pushed
// off the right edge by whatever was already on the line.
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await linkEditor.pressSequentially('She came from [[Atl', { delay: 25 });
await page.waitForTimeout(400);
await shot('34-link-picker', {
  clip: '.tiptap',
  pad: 140,
  marks: [
    { selector: '.doc-link-picker', label: 'Type [[ and pick a document', place: 'right' },
  ],
});

await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await shot('35-doc-link', {
  clip: '.tiptap',
  pad: 24,
  marks: [{ selector: '.doc-link', label: 'Click to jump there', place: 'right' }],
});

// The other direction: Atlantis now shows what links to it.
await page.locator('.toolbar-back-btn').click();
await page.locator('.document-card', { hasText: 'Atlantis' }).first().click();
await page.waitForSelector('.tiptap');
await page.locator('.sidebar-tab', { hasText: 'Info' }).click();
await page.waitForTimeout(600);
await shot('36-linked-from', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [{ selector: '.backlink-row', label: 'Everywhere that mentions this document', place: 'left' }],
});

// ── 8. Dating an excerpt, and the timeline ────────────────────────────────────

await page.locator('.toolbar-back-btn').click();
await page.locator('.document-card', { hasText: 'Hololore' }).first().click();
await page.waitForSelector('.tiptap');
await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
await page.locator('.category-name-link', { hasText: 'HISTORY' }).first().click();
await page.waitForTimeout(500);
await page.locator('.placement-note-add', { hasText: '+ when' }).first().click();
await page.locator('.placement-when-input').fill('Year 300 of the Third Age');
await shot('37-when-field', {
  clip: '.right-sidebar',
  pad: 300,
  marks: [{ selector: '.placement-when-input', label: 'Your calendar, in your own words', place: 'left' }],
});
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
await page.keyboard.press('Escape');

// A second event, earlier and in another document — a timeline of one entry proves
// nothing about ordering, or about gathering from across the world.
await page.locator('.toolbar-back-btn').click();
await page.locator('.document-card', { hasText: 'Atlantis' }).first().click();
await page.waitForSelector('.tiptap');
await page.locator('.tiptap').first().click();
await page.keyboard.press('Meta+A');
await page.waitForTimeout(400);
await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
await page.waitForTimeout(300);
const atlModal = page.locator('.modal', { hasText: 'Add Tag' });
const atlHistory = await atlModal
  .locator('select.input option', { hasText: 'HISTORY' })
  .first()
  .getAttribute('value');
await atlModal.locator('select.input').selectOption(atlHistory);
await atlModal.locator('.autocomplete-item', { hasText: 'Gura' }).first().click();
await page.waitForTimeout(900);

await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
await page.locator('.category-name-link', { hasText: 'HISTORY' }).first().click();
await page.waitForTimeout(500);
const undatedRow = page.locator('.placement-row', { hasText: 'drowned city' });
await undatedRow.locator('.placement-note-add', { hasText: '+ when' }).click();
await page.locator('.placement-when-input').fill('Year 12 of the Third Age');
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
await page.keyboard.press('Escape');

await page.locator('.toolbar-btn[aria-label="Timeline"]').click();
await page.waitForTimeout(700);
await shot('38-timeline', {
  clip: '.timeline-overlay',
  pad: 0,
  marks: [
    { selector: '.timeline-moment__when', label: 'Earliest first, whatever your calendar', place: 'right' },
    { selector: '.timeline-event', nth: 1, label: 'Click to open the passage it came from', place: 'right' },
  ],
});
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ── 9. Settings, including backup ─────────────────────────────────────────────

await page.locator('.toolbar-btn[aria-label="Settings"]').click();
await page.waitForTimeout(400);
await shot('23-settings', {
  clip: '.modal',
  pad: 150,
  marks: [{ selector: '.theme-grid', label: 'Four themes, or follow your system', place: 'right' }],
});

// Scroll the Backup section into view inside the modal before shooting it.
await page.locator('.settings-button-row').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot('39-backup', {
  clip: '.modal',
  pad: 150,
  marks: [
    { selector: '.settings-button-row', label: 'Everything, in one file', place: 'below' },
  ],
});
await page.locator('.modal .btn-primary', { hasText: 'Done' }).click();

console.log('\nDone. Screenshots written to docs/screenshots/');
await app.close();

for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
