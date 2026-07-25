import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

/**
 * `[[Document]]` links, from typing one to following it back.
 */
let page: Page;
registerAppHooks(handles => {
  page = handles.page;
});

/** Back to the document list, if we are not already there. */
async function goHome() {
  const back = page.locator('.toolbar-back-btn');
  if (await back.isVisible()) await back.click();
  await expect(page.locator('.document-card-new')).toBeVisible();
}

/** A document with one section, ready to write in. */
async function createDocument(title: string) {
  await goHome();
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal .btn-primary').click();
  await expect(page.locator('.main-toolbar')).toContainText(title);
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  await expect(page.locator('.tiptap')).toBeVisible();
}

async function openDocument(title: string) {
  await goHome();
  await page.locator('.document-card', { hasText: title }).first().click();
  await expect(page.locator('.main-toolbar')).toContainText(title);
}

/** Type into the first section's editor, one key at a time as a person would. */
async function type(text: string) {
  const editor = page.locator('.tiptap').first();
  await editor.click();
  await editor.pressSequentially(text, { delay: 15 });
}

test.describe('Links between documents', () => {
  test('typing [[ offers the other documents and inserts a link', async () => {
    await createDocument('GURA');
    await createDocument('PEKORA');

    await type('She once fought [[GUR');

    const picker = page.locator('.doc-link-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('.doc-link-picker__item')).toHaveText(['GURA']);

    await page.keyboard.press('Enter');
    await expect(picker).toBeHidden();

    const link = page.locator('.tiptap .doc-link');
    await expect(link).toHaveText('GURA');
    // The brackets and the half-typed name are consumed, not left behind.
    await expect(page.locator('.tiptap').first()).not.toContainText('[[');
  });

  test('the picker never offers the document you are already in', async () => {
    await createDocument('GURA');
    await type('[[');
    // GURA is the only document, and it is this one, so there is nothing to offer.
    await expect(page.locator('.doc-link-picker')).toBeHidden();
  });

  test('clicking a link opens the document it points at', async () => {
    await createDocument('GURA');
    await createDocument('PEKORA');
    await type('See [[GURA');
    await page.keyboard.press('Enter');
    await expect(page.locator('.tiptap .doc-link')).toHaveText('GURA');

    await page.locator('.tiptap .doc-link').click();
    await expect(page.locator('.main-toolbar')).toContainText('GURA');
  });

  test('the linked-to document shows what links to it', async () => {
    await createDocument('GURA');
    await createDocument('PEKORA');
    await type('See [[GURA');
    await page.keyboard.press('Enter');
    await expect(page.locator('.tiptap .doc-link')).toHaveText('GURA');
    // Give the debounced save time to reach the database, which is where links are read from.
    await page.waitForTimeout(1500);

    await openDocument('GURA');
    const backlinks = page.locator('.info-section', { hasText: 'Linked from' });
    await expect(backlinks.locator('.backlink-row__title')).toHaveText('PEKORA', { timeout: 10000 });
  });

  test('renaming a document updates the links pointing at it', async () => {
    await createDocument('GURA');
    await createDocument('PEKORA');
    await type('See [[GURA');
    await page.keyboard.press('Enter');
    await expect(page.locator('.tiptap .doc-link')).toHaveText('GURA');
    await page.waitForTimeout(1500);

    // Rename GURA from its own Arrange tab, then come back to the document that links to it.
    await openDocument('GURA');
    await page.locator('.sidebar-tab', { hasText: 'Arrange' }).click();
    await page.locator('.arrange-row--title').click();
    await page.locator('.input-group input.input').first().fill('GAWR GURA');
    await page.keyboard.press('Enter');
    await expect(page.locator('.main-toolbar')).toContainText('GAWR GURA');

    await openDocument('PEKORA');
    // The link stores an id, so it reads the new name without the text being touched.
    await expect(page.locator('.tiptap .doc-link')).toHaveText('GAWR GURA');
  });
});
