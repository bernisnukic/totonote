import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

// Embedded images: import, storage in the database, and rendering back over totonote://

let app: ElectronApplication;
let page: Page;
registerAppHooks(h => {
  app = h.app;
  page = h.page;
});

/**
 * A real 8x4 PNG, base64. Small enough to inline, but genuine bytes — the point is to
 * exercise decoding, storage and the protocol handler rather than to look at anything.
 */
const TEST_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAGUlEQVR4nGP4P9/Z4/ZvTJIBqyiQZCBZBwB+iD/x62W8gAAAAABJRU5ErkJggg==';

/** Paste a PNG into the focused editor, the way a real paste arrives. */
async function pasteImage(name = 'portrait.png') {
  await page.evaluate(
    async ({ b64, filename }) => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([bytes], filename, { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const target = document.querySelector('.tiptap');
      target?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { b64: TEST_PNG, filename: name },
  );
}

async function docWithSection(title = 'Image Doc') {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  await expect(page.locator('.tiptap')).toBeVisible();
}

test.describe('Embedded images', () => {
  test('pasting an image stores it and renders it from the database', async () => {
    await docWithSection();
    await page.locator('.tiptap').first().click();
    await pasteImage();

    const img = page.locator('.tiptap img');
    await expect(img).toBeVisible({ timeout: 10000 });

    // The document holds only a reference — the bytes live in the media table.
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^totonote:\/\/media\/[0-9a-f-]+$/);

    // And the protocol actually served pixels: a broken image has naturalWidth 0.
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10000 })
      .toBeGreaterThan(0);
  });

  test('an embedded image survives leaving and reopening the document', async () => {
    await docWithSection();
    await page.locator('.tiptap').first().click();
    await pasteImage();
    await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 10000 });
    const srcBefore = await page.locator('.tiptap img').getAttribute('src');

    await page.waitForTimeout(1500); // let the debounced save land
    await page.locator('.toolbar-back-btn').click();
    await page.locator('.document-card', { hasText: 'Image Doc' }).click();

    const img = page.locator('.tiptap img');
    await expect(img).toBeVisible({ timeout: 10000 });
    expect(await img.getAttribute('src')).toBe(srcBefore);
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10000 })
      .toBeGreaterThan(0);
  });

  test('the image bytes are not written into the section content', async () => {
    // Inlining a data URI would be re-saved every second and copied into every History
    // checkpoint, which is the whole reason media lives in its own table.
    await docWithSection();
    await page.locator('.tiptap').first().click();
    await pasteImage();
    await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Read the stored content back through the app's own IPC.
    const stored = await page.evaluate(async () => {
      const api = (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api;
      const el = document.querySelector('[data-section-id]');
      const id = el?.getAttribute('data-section-id');
      const section = (await api.invoke('section:get', { id })) as { content: string } | null;
      return section?.content ?? '';
    });
    expect(stored).toContain('totonote://media/');
    expect(stored).not.toContain('data:image');
    expect(stored.length).toBeLessThan(2000); // a reference, not bytes
  });

  test('a filed image shows as a thumbnail on the category page', async () => {
    // The point of the whole feature for a lore wiki: a character's portrait appearing on
    // the character's compiled page, not an empty row.
    await docWithSection('Portrait Doc');

    // A category to file it under.
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('GURA');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.category-node-name', { hasText: 'GURA' })).toBeVisible();

    // Paste the image, then select and tag it, filing it under GURA.
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await pasteImage();
    await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('ControlOrMeta+A');
    await expect(page.locator('.selection-toolbar')).toBeVisible();
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    const value = await modal
      .locator('select.input option', { hasText: 'GURA' })
      .first()
      .getAttribute('value');
    await modal.locator('select.input').selectOption(value!);
    await modal.locator('.autocomplete input.input').fill('Portrait');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await page.waitForTimeout(1500); // content has to persist before the page compiles

    // Open GURA's page — the excerpt is a picture, so it shows one.
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.category-name-link', { hasText: 'GURA' }).click();
    const info = page.locator('.right-sidebar');
    await expect(info.locator('.placement-row')).toHaveCount(1);
    const thumb = info.locator('.placement-thumb');
    await expect(thumb).toBeVisible();
    await expect
      .poll(async () => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10000 })
      .toBeGreaterThan(0);
  });

  test('reports how much space embedded images use', async () => {
    await docWithSection();
    await page.locator('.tiptap').first().click();
    await pasteImage();
    await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 10000 });

    const usage = await page.evaluate(async () => {
      const api = (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api;
      return (await api.invoke('media:usage')) as { count: number; totalBytes: number };
    });
    expect(usage.count).toBe(1);
    expect(usage.totalBytes).toBeGreaterThan(0);
  });
});
