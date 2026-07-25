import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

// Resizing pictures, and renaming documents and sections — all previously impossible.

let app: ElectronApplication;
let page: Page;
registerAppHooks(h => {
  app = h.app;
  page = h.page;
});

const TEST_PNG =
  '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';

async function docWithSection(title = 'Extras') {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  await expect(page.locator('.tiptap')).toBeVisible();
}

test.describe('Renaming', () => {
  test('renames a section from the Arrange tab', async () => {
    await docWithSection();
    await page.locator('.sidebar-tab', { hasText: 'Arrange' }).click();
    await page.locator('.arrange-row__title--editable', { hasText: 'Main' }).click();
    const input = page.locator('.arrange-row').locator('input.input').first();
    await input.fill('Ancient Age');
    await input.press('Enter');

    await expect(page.locator('.section-tab')).toContainText('Ancient Age');
    // And it survives a reload, so it really was written.
    await page.locator('.toolbar-back-btn').click();
    await page.locator('.document-card', { hasText: 'Extras' }).click();
    await expect(page.locator('.section-tab')).toContainText('Ancient Age');
  });

  test('renames the document itself', async () => {
    await docWithSection('Old Name');
    await page.locator('.sidebar-tab', { hasText: 'Arrange' }).click();
    await page.locator('.arrange-row--title').click();
    const input = page.locator('.input-group').locator('input.input').first();
    await input.fill('New Name');
    await input.press('Enter');
    await page.waitForTimeout(400);

    await page.locator('.toolbar-back-btn').click();
    await expect(page.locator('.document-card', { hasText: 'New Name' })).toBeVisible();
  });
});

test.describe('Resizing a picture', () => {
  test('drag the handle and the width sticks', async () => {
    await docWithSection('Pictures');
    await page.locator('.tiptap').first().click();
    await page.evaluate(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([bytes], 'p.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document
        .querySelector('.tiptap')
        ?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, TEST_PNG);

    const image = page.locator('.resizable-image img');
    await expect(image).toBeVisible({ timeout: 10000 });
    const before = (await image.boundingBox())!.width;

    // Drag the corner handle inward.
    const handle = page.locator('.resizable-image__handle');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 120, box.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1600); // let the save land

    const after = (await image.boundingBox())!.width;
    expect(after).toBeLessThan(before);

    // The chosen width is stored on the node, not just applied in the DOM.
    const stored = await page.evaluate(async () => {
      const api = (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api;
      const id = document.querySelector('[data-section-id]')?.getAttribute('data-section-id');
      const section = (await api.invoke('section:get', { id })) as { content: string } | null;
      return section?.content ?? '';
    });
    expect(stored).toMatch(/"width":\s*\d+/);
  });
});
