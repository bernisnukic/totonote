import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks, acceptConfirm } from './fixtures';

// Full-text search over the writing itself — not just category and tag names.

let app: ElectronApplication;
let page: Page;
registerAppHooks(h => {
  app = h.app;
  page = h.page;
});

async function docWith(title: string, sectionTitle: string, text: string) {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill(sectionTitle);
  await page.locator('.modal .btn-primary').click();
  const editor = page.locator('.tiptap').first();
  await editor.click();
  await editor.pressSequentially(text, { delay: 10 });
  await page.waitForTimeout(1600); // let the debounced save (and re-index) land
}

test.describe('Searching your writing', () => {
  test('finds a passage by a word inside it and opens it', async () => {
    await docWith('Hololore', 'Ancient Age', 'Gura arrived from the frozen deep.');
    await page.locator('.toolbar-back-btn').click();
    await docWith('Second World', 'Modern Era', 'Pekora built a carrot empire.');

    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('carrot');

    const hits = page.locator('.sidebar-writing-hit');
    await expect(hits).toHaveCount(1, { timeout: 10000 });
    await expect(hits.first()).toContainText('Second World');
    await expect(hits.first().locator('.search-match')).toContainText('carrot');
  });

  test('searches across documents, not just the open one', async () => {
    await docWith('Hololore', 'Ancient Age', 'The frozen deep hides an old temple.');
    await page.locator('.toolbar-back-btn').click();
    await docWith('Second World', 'Modern Era', 'Nothing relevant here.');

    // Currently inside "Second World"; the match lives in the other document.
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('temple');
    const hit = page.locator('.sidebar-writing-hit').first();
    await expect(hit).toContainText('Hololore', { timeout: 10000 });

    // Clicking it opens that document at the right section.
    await hit.click();
    await expect(page.locator('.tiptap').first()).toContainText('old temple', { timeout: 10000 });
  });

  test('narrows as you type and reports when there is nothing', async () => {
    await docWith('Hololore', 'Ancient Age', 'An ancient leviathan sleeps below.');
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();

    await page.locator('.sidebar-search-input').fill('levi');
    await expect(page.locator('.sidebar-writing-hit')).toHaveCount(1, { timeout: 10000 });

    await page.locator('.sidebar-search-input').fill('zzzznothing');
    await expect(page.locator('.sidebar-writing-results')).toContainText('No matches', { timeout: 10000 });
  });

  test('drops a section from results once it is deleted', async () => {
    await docWith('Hololore', 'Ancient Age', 'A unique findable phrase.');
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('findable');
    await expect(page.locator('.sidebar-writing-hit')).toHaveCount(1, { timeout: 10000 });

    await page.locator('.section-tab', { hasText: 'Ancient Age' }).locator('.tab-close').click();
    await acceptConfirm(page);
    await page.waitForTimeout(600);

    await page.locator('.sidebar-search-input').fill('');
    await page.locator('.sidebar-search-input').fill('findable');
    await expect(page.locator('.sidebar-writing-results')).toContainText('No matches', { timeout: 10000 });
  });
});
