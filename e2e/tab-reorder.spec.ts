import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

/**
 * Reordering sections by dragging their tabs, the way browser tabs work.
 */
let page: Page;
registerAppHooks(handles => {
  page = handles.page;
});

async function addSection(title: string, abbreviation: string) {
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal input.input').nth(1).fill(abbreviation);
  await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
  await expect(page.locator('.section-tab', { hasText: title })).toBeVisible();
}

async function tabOrder(): Promise<string[]> {
  return page.locator('.section-tab .tab-label').allTextContents();
}

test.describe('Section tabs', () => {
  test('can be dragged into a different order, and it sticks', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Ordering');
    await page.locator('.modal .btn-primary').click();
    await addSection('Alpha', 'ALP');
    await addSection('Beta', 'BET');
    await addSection('Gamma', 'GAM');
    expect(await tabOrder()).toEqual(['Alpha', 'Beta', 'Gamma']);

    // Drag the last tab onto the first.
    await page.locator('.section-tab', { hasText: 'Gamma' }).dragTo(
      page.locator('.section-tab', { hasText: 'Alpha' }),
    );
    await expect.poll(tabOrder, { timeout: 10000 }).toEqual(['Gamma', 'Alpha', 'Beta']);

    // The order is the document's, not the screen's — leaving and coming back keeps it.
    await page.locator('.toolbar-back-btn').click();
    await page.locator('.document-card', { hasText: 'Ordering' }).first().click();
    await expect.poll(tabOrder, { timeout: 10000 }).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  test('a single tab is not draggable, so it cannot be dropped on itself', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Just One');
    await page.locator('.modal .btn-primary').click();
    await addSection('Only', 'ONE');
    await expect(page.locator('.section-tab')).toHaveAttribute('draggable', 'false');
  });
});
