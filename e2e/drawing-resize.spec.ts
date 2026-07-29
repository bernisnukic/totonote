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

/** Drag the corner handle left by `by` pixels. */
async function shrinkBy(by: number) {
  const handle = page.locator('.drawing-node__handle');
  const box = await handle.boundingBox();
  if (!box) throw new Error('no resize handle');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - by, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.describe('Resizing a tagged drawing', () => {
  test('the highlight stays, and follows the new width', async () => {
    await setup();
    await tagTheDrawing('Sketch');

    const node = page.locator('.annotation-highlight--node');
    const before = await node.boundingBox();
    await shrinkBy(150);

    // Still highlighted — it used to disappear until something re-synced.
    await expect(page.locator('.annotation-highlight--node')).toBeVisible();

    // And narrower: the highlight is drawn around the node, so the node must have shrunk.
    const after = await node.boundingBox();
    expect(after!.width).toBeLessThan(before!.width - 50);
  });

  test('the highlight box matches the drawing, not the column', async () => {
    await setup();
    await tagTheDrawing('Sketch');
    await shrinkBy(150);

    const node = await page.locator('.annotation-highlight--node').boundingBox();
    const surface = await page.locator('.drawing-node__surface').boundingBox();
    // The outline hugs the drawing rather than running the width of the page.
    expect(Math.abs(node!.width - surface!.width)).toBeLessThan(12);
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
