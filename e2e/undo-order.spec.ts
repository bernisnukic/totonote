import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

/**
 * Writing and tagging share one undo order.
 *
 * Reported: type text → tag it → one Ctrl+Z threw away the tag *and* the text together,
 * because undoing the typing removed the words the highlight sat on. Each should be its
 * own step.
 */
let app: ElectronApplication;
let page: Page;
registerAppHooks(handles => {
  app = handles.app;
  page = handles.page;
});

/** Undo/redo arrive through the Edit menu, which is how the app receives Cmd+Z. */
const undo = () =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu:undo'));
const redo = () =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu:redo'));

async function setup() {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('Undo Order');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  const editor = page.locator('.tiptap').first();
  await editor.click();
  await editor.pressSequentially('GURA IS A SHARK', { delay: 15 });
  return editor;
}

async function tagAll(name: string) {
  await page.keyboard.press('ControlOrMeta+A');
  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  const modal = page.locator('.modal');
  await modal.locator('.autocomplete input.input').fill(name);
  await modal.locator('.autocomplete-item-create').click();
  await modal.locator('.btn-primary', { hasText: 'Create' }).click();
  await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.right-sidebar')).toContainText(name, { timeout: 20000 });
}

test.describe('Undo order', () => {
  test('takes the tag off first, then the text', async () => {
    const editor = await setup();
    await tagAll('Marker');

    // One undo: the highlight goes, the words stay.
    await undo();
    await expect(page.locator('.annotation-highlight')).toHaveCount(0, { timeout: 10000 });
    await expect(editor).toContainText('GURA IS A SHARK');

    // A second undo takes the writing.
    await undo();
    await expect(editor).not.toContainText('GURA IS A SHARK', { timeout: 10000 });
  });

  test('puts them back in the order they happened', async () => {
    const editor = await setup();
    await tagAll('Marker');
    await undo();
    await undo();
    await expect(editor).not.toContainText('GURA IS A SHARK', { timeout: 10000 });

    // Text first…
    await redo();
    await expect(editor).toContainText('GURA IS A SHARK', { timeout: 10000 });
    await expect(page.locator('.annotation-highlight')).toHaveCount(0);

    // …then the tag that was put on it.
    await redo();
    await expect(page.locator('.annotation-highlight')).toHaveCount(1, { timeout: 10000 });
  });

  test('undoing a tag does not disturb the writing', async () => {
    const editor = await setup();
    await tagAll('Marker');
    await undo();
    await expect(page.locator('.annotation-highlight')).toHaveCount(0, { timeout: 10000 });
    // The exact text, unchanged — this is what used to vanish along with the tag.
    expect((await editor.textContent())?.trim()).toBe('GURA IS A SHARK');
  });
});
