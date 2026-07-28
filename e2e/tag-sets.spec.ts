import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

/**
 * Tag sets: a named group of tags applied together.
 *
 * The point of the design is that a set is a *shortcut*, not a tag. Tagging with a set puts
 * its member tags on the text, so a passage tagged with a large set still satisfies every
 * smaller combination inside it — which is what makes the combinations compose instead of
 * having to be enumerated.
 */
let page: Page;
registerAppHooks(handles => {
  page = handles.page;
});

async function setup() {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('Sets');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  const editor = page.locator('.tiptap').first();
  await editor.click();
  await editor.pressSequentially('The siege of the northern keep', { delay: 15 });
  return editor;
}

/** Make a tag by tagging the line, then undo the tagging so only the tag remains. */
async function makeTag(name: string) {
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await expect(page.locator('.selection-toolbar')).toBeVisible({ timeout: 15000 });
  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  const modal = page.locator('.modal');
  await modal.locator('.autocomplete input.input').fill(name);
  await modal.locator('.autocomplete-item-create').click();
  await modal.locator('.btn-primary', { hasText: 'Create' }).click();
  await expect(page.locator('.right-sidebar')).toContainText(name, { timeout: 20000 });
}

test.describe('Tag sets', () => {
  test('applying a set puts every one of its tags on the text', async () => {
    const editor = await setup();
    await makeTag('Battle');
    await makeTag('Keep');

    // Build a set of the two, from the Edit tab.
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ Create tag set' }).click();
    await page.locator('.tag-set-editor input.input').fill('Sieges');
    for (const name of ['Battle', 'Keep']) {
      await page.locator('.tag-set-picker__item', { hasText: name }).locator('input').check();
    }
    await page.locator('.tag-set-editor .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.tag-set-row-item__name', { hasText: 'Sieges' })).toBeVisible();

    // Remove the highlights that creating the tags left behind, then apply the set.
    await editor.click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await expect(page.locator('.selection-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    await page.locator('.tag-set-chip', { hasText: 'Sieges' }).click();

    // Both tags are on the passage — the set itself is not a tag and adds nothing else.
    await expect(page.locator('.right-sidebar')).toContainText('Battle', { timeout: 20000 });
    await expect(page.locator('.right-sidebar')).toContainText('Keep');
  });

  test('a set needs at least two tags, or it is just the tag', async () => {
    await setup();
    await makeTag('Battle');
    await makeTag('Keep');

    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ Create tag set' }).click();
    await page.locator('.tag-set-editor input.input').fill('Lonely');
    await page.locator('.tag-set-picker__item', { hasText: 'Battle' }).locator('input').check();
    await expect(page.locator('.tag-set-editor .btn-primary')).toBeDisabled();

    await page.locator('.tag-set-picker__item', { hasText: 'Keep' }).locator('input').check();
    await expect(page.locator('.tag-set-editor .btn-primary')).toBeEnabled();
  });

  test('deleting a set leaves its tags alone', async () => {
    await setup();
    await makeTag('Battle');
    await makeTag('Keep');

    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ Create tag set' }).click();
    await page.locator('.tag-set-editor input.input').fill('Sieges');
    for (const name of ['Battle', 'Keep']) {
      await page.locator('.tag-set-picker__item', { hasText: name }).locator('input').check();
    }
    await page.locator('.tag-set-editor .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.tag-set-row-item__name', { hasText: 'Sieges' })).toBeVisible();

    await page.locator('.tag-set-row-item', { hasText: 'Sieges' }).locator('.btn-ghost').click();
    const modal = page.locator('.modal', { has: page.locator('.confirm-message') });
    await expect(modal).toContainText('untouched');
    await modal.locator('.modal-footer .btn-danger').click();

    await expect(page.locator('.tag-set-row-item')).toHaveCount(0);
    // Both tags survive.
    await expect(page.locator('.tag-set-picker, .category-tree')).toBeVisible();
  });
});
