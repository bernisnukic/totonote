import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks, acceptConfirm, declineConfirm } from './fixtures';

/**
 * What happens to a highlight when the text under it goes away.
 *
 * Reported: deleting highlighted text left the annotation in the database with nothing to
 * point at, so every compiled page showed it as "…", and there was no warning first.
 */
let page: Page;
registerAppHooks(handles => {
  page = handles.page;
});

async function setup(text: string) {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('Lifecycle');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  const editor = page.locator('.tiptap').first();
  await editor.click();
  await editor.pressSequentially(text, { delay: 15 });
  return editor;
}

/** Tag the whole line — selected the same deterministic way it is deleted later. */
async function tagAll(name: string) {
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  const modal = page.locator('.modal');
  await modal.locator('.autocomplete input.input').fill(name);
  await modal.locator('.autocomplete-item-create').click();
  await modal.locator('.btn-primary', { hasText: 'Create' }).click();
  // Wait for the decoration to carry an id: that only happens once the annotation itself
  // exists, which is what the delete warning consults.
  await expect(page.locator('.annotation-highlight[data-annotation-id]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.right-sidebar')).toContainText(name, { timeout: 20000 });
}

/**
 * Select the whole line the caret is on.
 *
 * Deliberately not Ctrl/Cmd+A: what that selects differs between platforms — on macOS it
 * gave the paragraph's text, and it is the one step these tests cannot afford to be vague
 * about, since the warning depends on the selection actually covering the highlight.
 */
async function selectTheLine() {
  await page.locator('.tiptap').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
}

test.describe('Deleting highlighted text', () => {
  test('asks first, and says how many highlights go with it', async () => {
    const editor = await setup('Gura was born in Atlantis.');
    await tagAll('Gura');

    await selectTheLine();
    await page.keyboard.press('Backspace');

    const warning = await acceptConfirm(page);
    expect(warning).toContain('highlight');
    await expect(editor).not.toContainText('Atlantis');
  });

  test('leaves no empty excerpt behind on the pages', async () => {
    const editor = await setup('Gura was born in Atlantis.');
    await tagAll('Gura');

    await selectTheLine();
    await page.keyboard.press('Backspace');
    await acceptConfirm(page);
    // Let the debounced save run, which is where the cleanup happens.
    await page.waitForTimeout(1600);

    // The tag's page must be empty, not showing an excerpt with no text in it.
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    // Searching expands the category holding the tag; without it the row stays collapsed.
    await page.locator('.sidebar-search-input').fill('Gura');
    await page.locator('.tag-tree-item', { hasText: 'Gura' }).first().click();
    await expect(page.locator('.right-sidebar .placement-row')).toHaveCount(0);
  });

  test('changing your mind leaves the text and the highlight alone', async () => {
    const editor = await setup('Gura was born in Atlantis.');
    await tagAll('Gura');

    await selectTheLine();
    await page.keyboard.press('Backspace');
    await declineConfirm(page);

    await expect(editor).toContainText('Atlantis');
    await expect(page.locator('.annotation-highlight')).toBeVisible();
  });

  test('deleting text with no highlight in it just deletes', async () => {
    const editor = await setup('Nothing tagged here.');
    await selectTheLine();
    await page.keyboard.press('Backspace');
    // No dialog at all — this must not become a prompt on every deletion.
    await expect(page.locator('.confirm-message')).toHaveCount(0);
    await expect(editor).not.toContainText('Nothing tagged');
  });
});
