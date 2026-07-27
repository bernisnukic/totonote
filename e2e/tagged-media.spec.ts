import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks, acceptConfirm, declineConfirm } from './fixtures';

/**
 * Tagging a picture or a drawing.
 *
 * Reported: tagging an image "doesn't register" — no colour appeared, there was nothing to
 * right-click, and you could tag the same image over and over without noticing. The
 * annotation was being created; it just drew nothing, because an inline decoration has no
 * text to wrap on an atom node.
 */
let page: Page;
registerAppHooks(handles => {
  page = handles.page;
});

const TEST_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAGUlEQVR4nGP4P9/Z4/ZvTJIBqyiQZCBZBwB+iD/x62W8gAAAAABJRU5ErkJggg==';

async function pasteImage() {
  await page.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const file = new File([bytes], 'portrait.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector('.tiptap')
      ?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, TEST_PNG);
}

async function setup() {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill('Media Tags');
  await page.locator('.modal .btn-primary').click();
  await page.locator('.tab-add').click();
  await page.locator('.modal input.input').first().fill('Main');
  await page.locator('.modal .btn-primary').click();
  const editor = page.locator('.tiptap').first();
  await editor.click();
  await editor.pressSequentially('A portrait of her', { delay: 15 });
  await pasteImage();
  await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 15000 });
  return editor;
}

/** Select the picture itself, the way you would by clicking it, then tag. */
async function tagTheImage(name: string) {
  await page.locator('.tiptap img').click();
  await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
  const modal = page.locator('.modal');
  await modal.locator('.autocomplete input.input').fill(name);
  await modal.locator('.autocomplete-item-create').click();
  await modal.locator('.btn-primary', { hasText: 'Create' }).click();
  await expect(page.locator('.right-sidebar')).toContainText(name, { timeout: 20000 });
}

test.describe('Which section a tag lands in', () => {
  test('a highlight goes to the section its text is in, not the active one', async () => {
    // All sections are on one page, each with its own editor, and which counts as
    // "active" follows the scroll. Tagging just after moving between sections could
    // attach the highlight to the previous one, at positions meaning nothing there — so
    // it silently drew no highlight at all.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Two Sections');
    await page.locator('.modal .btn-primary').click();
    for (const title of ['One', 'Two']) {
      await page.locator('.tab-add').click();
      await page.locator('.modal input.input').first().fill(title);
      await page.locator('.modal .btn-primary').click();
    }
    await page.waitForTimeout(700); // the scroll guard armed by creating a section

    const first = page.locator('.tiptap').nth(0);
    const second = page.locator('.tiptap').nth(1);
    await first.click();
    await first.pressSequentially('Short line', { delay: 15 });
    // Straight into the other editor without switching tabs — the case that failed.
    await second.click();
    await second.pressSequentially('A considerably longer line of writing', { delay: 15 });
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    // The floating toolbar follows the selection; wait for it rather than racing it.
    await expect(page.locator('.selection-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Lair');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();

    // The highlight is drawn, and it is on the words that were selected.
    const highlight = page.locator('.annotation-highlight');
    await expect(highlight).toHaveCount(1, { timeout: 20000 });
    await expect(highlight).toContainText('A considerably longer line of writing');
  });
});

test.describe('Working with a picture', () => {
  test('can be deleted from its right-click menu, after asking', async () => {
    await setup();
    await page.locator('.tiptap img').click({ button: 'right' });
    const warning = await acceptConfirm(page);
    expect(warning).toContain('picture');
    await expect(page.locator('.tiptap img')).toHaveCount(0, { timeout: 10000 });
  });

  test('changing your mind leaves it alone', async () => {
    await setup();
    await page.locator('.tiptap img').click({ button: 'right' });
    await declineConfirm(page);
    await expect(page.locator('.tiptap img')).toHaveCount(1);
  });

  test('a section starting with a picture still has a line to write on above it', async () => {
    // Reported: starting a section with an image left nowhere to put an opening line —
    // there is no position before the first block, so the caret could not go there.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Leading Image');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await pasteImage(); // straight into an empty section
    await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 15000 });

    // A paragraph is kept above it, and it takes writing.
    const firstLine = page.locator('.tiptap > p').first();
    await expect(firstLine).toBeVisible();
    await firstLine.click();
    await page.keyboard.type('A caption above it');
    await expect(editor).toContainText('A caption above it');
  });
});

test.describe('Tagging a picture', () => {
  test('the same tag on the same picture twice makes one highlight, not two', async () => {
    await setup();
    await tagTheImage('Portrait');
    await expect(page.locator('.tiptap .annotation-highlight--node')).toHaveCount(1, { timeout: 15000 });

    // Tag it again with the same tag: nothing new should appear.
    await page.locator('.tiptap img').click();
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Portrait');
    await modal.locator('.autocomplete-item', { hasText: 'Portrait' }).first().click();
    await page.waitForTimeout(1200);
    await expect(page.locator('.tiptap .annotation-highlight--node')).toHaveCount(1);
  });

  test('shows on the picture itself, so you can see it worked', async () => {
    await setup();
    await tagTheImage('Portrait');

    // The picture's own node carries the highlight, not just the text beside it. (The
    // class lands on the node view's wrapper, which is what ProseMirror decorates.)
    const tagged = page.locator('.tiptap .annotation-highlight--node');
    await expect(tagged.first()).toBeVisible({ timeout: 15000 });
    await expect(tagged.first().locator('img')).toHaveCount(1);
  });

  test('can be right-clicked, so it can be removed again', async () => {
    await setup();
    await tagTheImage('Portrait');

    const tagged = page.locator('.tiptap [data-annotation-id]').first();
    await expect(tagged).toBeVisible({ timeout: 15000 });
    await tagged.click({ button: 'right' });
    // The annotation menu, not the plain text-selection one — proof the click found it.
    await expect(page.locator('.context-menu-item', { hasText: 'Remove annotation' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('deleting the picture asks about its highlight first', async () => {
    const editor = await setup();
    await tagTheImage('Portrait');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    const warning = await acceptConfirm(page);
    expect(warning).toContain('highlight');
  });
});
