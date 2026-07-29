import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

/**
 * Resizing a drawing that carries a tag.
 *
 * Reported with a recording: the highlight kept the full column width while the drawing
 * shrank inside it, and then vanished after the resize, coming back only after clicking
 * around. Two separate faults — see the plugin and `.drawing-node` in editor.css.
 */
let page: Page;
registerAppHooks(handles => {
  page = handles.page;
});

async function setup() {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('Resize');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tiptap').first().click();
  await page.locator('.toolbar-btn[aria-label="Insert a drawing"]').click();
  await expect(page.locator('.drawing-node')).toBeVisible({ timeout: 10000 });
}

/** Tag the drawing by selecting it and using the floating toolbar. */
async function tagTheDrawing(name: string) {
  await page.locator('.drawing-node__surface').click();
  await expect(page.locator('.selection-toolbar')).toBeVisible({ timeout: 15000 });
  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  const modal = page.locator('.modal');
  await modal.locator('.autocomplete input.input').fill(name);
  await modal.locator('.autocomplete-item-create').click();
  await modal.locator('.btn-primary', { hasText: 'Create' }).click();
  await expect(page.locator('.annotation-highlight--node')).toBeVisible({ timeout: 20000 });
}

/** Drag the corner handle sideways. Negative narrows, positive widens. */
async function dragHandle(by: number, index = 0) {
  const handle = page.locator('.drawing-node__handle').nth(index);
  const box = await handle.boundingBox();
  if (!box) throw new Error('no resize handle');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + by, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

const shrinkBy = (by: number) => dragHandle(-by);

test.describe('Resizing a tagged drawing', () => {
  test('the highlight stays, and follows the new width', async () => {
    await setup();
    await tagTheDrawing('Sketch');

    const surface = page.locator('.drawing-node__surface');
    const before = (await surface.boundingBox())!.width;
    await shrinkBy(150);

    // Still highlighted — it used to disappear until something re-synced.
    await expect(page.locator('.annotation-highlight--node')).toHaveCount(1);

    const after = (await surface.boundingBox())!.width;
    expect(after).toBeLessThan(before - 50);
  });

  test('the outline is drawn on the drawing, not across the column', async () => {
    await setup();
    await tagTheDrawing('Sketch');
    await shrinkBy(150);

    // The decoration lands on TipTap's wrapper, which is always column-width; the visible
    // outline belongs on the drawing inside it, so that is where it must be.
    const outline = await page.locator('.drawing-node__surface').evaluate(el => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(outline.style).toBe('solid');
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });
});

test.describe('Resizing a drawing more than once', () => {
  test('a drawing that has been narrowed can be widened again', async () => {
    await setup();
    const surface = page.locator('.drawing-node__surface');

    // Drag by a share of the column rather than a fixed number of pixels: growing is
    // legitimately capped at the column width, so a fixed 150px would hit that ceiling
    // and look like the bug whenever the window happened to be narrow.
    const full = (await surface.boundingBox())!.width;
    await dragHandle(-Math.round(full * 0.5));
    const narrowed = (await surface.boundingBox())!.width;

    // Reported: "no matter what, it goes to smallest size and i can no longer resize
    // again". The width it could be dragged to was measured from the node's own wrapper,
    // which had been made to shrink to fit — so the ceiling was whatever it currently was
    // (in fact the width of the Draw button), and no drag could ever give width back.
    await dragHandle(Math.round(full * 0.25));
    const widened = (await surface.boundingBox())!.width;

    expect(widened).toBeGreaterThan(narrowed + full * 0.15);
  });
});

test.describe('Two tagged drawings', () => {
  test('their highlights do not overlap each other', async () => {
    await setup();
    await tagTheDrawing('First');

    // A second drawing directly below the first. Put the caret at the very end of the
    // document first — after tagging, the selection is still on the first drawing, and
    // inserting there would replace it rather than add one.
    await page.locator('.tiptap').first().click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.locator('.toolbar-btn[aria-label="Insert a drawing"]').click();
    await expect(page.locator('.drawing-node')).toHaveCount(2, { timeout: 10000 });

    await page.locator('.drawing-node__surface').nth(1).click();
    await expect(page.locator('.selection-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Second');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight--node')).toHaveCount(2, { timeout: 20000 });

    // Measure the drawings themselves: they are what carries the visible outline. The
    // wrapper the decoration lands on is column-width and the two wrappers sit flush, so
    // outlining those put the second highlight's top edge inside the first — which is what
    // the tester photographed.
    const surfaces = page.locator('.drawing-node__surface');
    const first = (await surfaces.nth(0).boundingBox())!;
    const second = (await surfaces.nth(1).boundingBox())!;
    // 2px of outline sitting 2px clear of each edge, so 8px is the point where they touch.
    expect(second.y - (first.y + first.height)).toBeGreaterThan(8);
  });
});

/** An 8x4 PNG — smaller than the resize handle, which is the whole point. */
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAGUlEQVR4nGP4P9/Z4/ZvTJIBqyiQZCBZBwB+iD/x62W8gAAAAABJRU5ErkJggg==';

test.describe('A picture smaller than its resize handle', () => {
  test('can still be clicked, so it can be selected and tagged', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Tiny');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await page.evaluate(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([bytes], 'icon.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.querySelector('.tiptap')?.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    }, TINY_PNG);
    await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 15000 });

    // The handle straddles the bottom-right corner and overlaps by about nine pixels, so
    // on a picture this size it used to cover the lot: every click landed on an invisible
    // control and selecting the picture at all was impossible. Clicking must reach the
    // picture, which the selection toolbar appearing proves.
    await page.locator('.tiptap img').click({ timeout: 10000 });
    await expect(page.locator('.selection-toolbar')).toBeVisible({ timeout: 15000 });
  });
});
