import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

// Tags, highlights and the selection toolbar

let page: Page;
registerAppHooks(h => {
  page = h.page;
});

// ─── Tag System ───────────────────────────────────────────────────────

test.describe('Tag System', () => {
  test.beforeEach(async () => {
    // Create doc with a section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Tag Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();
  });

  test('right sidebar shows Info/Arrange/Edit/History tabs', async () => {
    const tabs = page.locator('.sidebar-tab');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toHaveText('Info');
    await expect(tabs.nth(1)).toHaveText('Arrange');
    await expect(tabs.nth(2)).toHaveText('Edit');
    await expect(tabs.nth(3)).toHaveText('History');
  });

  test('creates a new tag via Edit panel', async () => {
    // Switch to Edit tab
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();

    // Click New Tag button
    await page.locator('.btn', { hasText: 'New Tag' }).click();

    // Fill in tag details
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await modal.locator('input.input').first().fill('Important Character');

    // Category should be auto-selected (first category: General)
    const categorySelect = modal.locator('select.input');
    await expect(categorySelect).toHaveValue('cat-general');

    // Click Create
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Tag should appear in the Edit panel
    await expect(page.locator('.badge', { hasText: 'Important Character' })).toBeVisible();
  });

  test('shows validation error when tag name is empty', async () => {
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();

    // Click Create without entering a name
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    // Error message should appear
    await expect(page.locator('.modal')).toContainText('Tag name is required');
  });

  test('creates multiple tags in the same category', async () => {
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();

    // Create first tag
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    let modal = page.locator('.modal');
    await modal.locator('input.input').first().fill('Warrior');
    await modal.locator('select.input').selectOption({ label: 'General' });
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();

    // Create second tag
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    modal = page.locator('.modal');
    await modal.locator('input.input').first().fill('Ancient Temple');
    await modal.locator('select.input').selectOption({ label: 'General' });
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();

    // Both tags should be visible
    await expect(page.locator('.badge', { hasText: 'Warrior' })).toBeVisible();
    await expect(page.locator('.badge', { hasText: 'Ancient Temple' })).toBeVisible();
  });
});

// ─── Selection Toolbar ────────────────────────────────────────────────

test.describe('Selection Toolbar', () => {
  test.beforeEach(async () => {
    // Create doc with section and type some text
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Selection Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Some sample text for testing selection features', { delay: 20 });
  });

  test('shows floating toolbar when text is selected', async () => {
    // Select text
    await page.keyboard.press('Meta+A');

    // Floating toolbar should appear
    await expect(page.locator('.selection-toolbar')).toBeVisible();
    await expect(page.locator('.selection-toolbar-btn', { hasText: 'Tag' })).toBeVisible();
  });

  test('Tag button opens tag selection modal', async () => {
    await page.keyboard.press('Meta+A');
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();

    // Modal should open
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal')).toContainText('Add Tag to Selection');
  });
});

// ─── Annotation Workflow ──────────────────────────────────────────────

test.describe('Annotation Workflow', () => {
  test('full annotation flow: create tag, annotate text, see highlight', async () => {
    // Create doc + section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Annotation Flow');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // Type content
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('The hero traveled to the ancient kingdom.', { delay: 20 });

    // Create a tag via Edit panel
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Hero');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    // Select text "hero" in the editor
    await editor.click();
    await page.keyboard.press('Meta+A');

    // Selection toolbar should appear
    await expect(page.locator('.selection-toolbar')).toBeVisible();

    // Click Tag button
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();

    // Tag modal should appear — search for "Hero" tag
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await modal.locator('.autocomplete input.input').fill('Hero');
    await expect(modal.locator('.autocomplete-item').first()).toContainText('Hero');

    // Select the tag
    await modal.locator('.autocomplete-item', { hasText: 'Hero' }).first().click();

    // Annotation highlight should appear after decorations sync
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Inline Tag Creation ─────────────────────────────────────────────

test.describe('Inline Tag Creation', () => {
  test('create tag from text selection', async () => {
    // Create doc + section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Inline Tag Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // Type content
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('The dragon breathed fire', { delay: 20 });

    // Select all text
    await page.keyboard.press('Meta+A');
    await expect(page.locator('.selection-toolbar')).toBeVisible();

    // Click Tag
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    // Type a new tag name to see "Create" option
    await modal.locator('.autocomplete input.input').fill('Dragon Fire');
    await expect(modal.locator('.autocomplete-item-create')).toBeVisible();

    // Click Create option
    await modal.locator('.autocomplete-item-create').click();

    // Should show creation form
    await expect(modal).toContainText('Create New Tag');
    await expect(modal.locator('input.input').first()).toHaveValue('Dragon Fire');

    // Click "Create & Tag"
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();

    // Annotation highlight should appear
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Color Picker ────────────────────────────────────────────────────

test.describe('Color Picker', () => {
  test('shows native color input and hex input', async () => {
    // Create doc + section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Color Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // Create a tag via Edit tab
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Color Tag');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    // Type content and annotate it with the tag
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Colored text', { delay: 20 });
    await page.keyboard.press('Meta+A');
    await expect(page.locator('.selection-toolbar')).toBeVisible();
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const tagModal = page.locator('.modal');
    await tagModal.locator('.autocomplete input.input').fill('Color Tag');
    await tagModal.locator('.autocomplete-item', { hasText: 'Color Tag' }).first().click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });

    // Switch to Info tab — tag should appear via annotations
    await page.locator('.sidebar-tab', { hasText: 'Info' }).click();
    await page.locator('.label-item', { hasText: 'Color Tag' }).click();

    // Options panel should have the enhanced color picker
    await expect(page.locator('.color-picker-container')).toBeVisible();
    await expect(page.locator('.color-picker-native')).toBeVisible();
    await expect(page.locator('.color-picker-hex-input')).toBeVisible();
  });
});

// ─── Tag Category Edit ──────────────────────────────────────────────

test.describe('Tag Category Edit', () => {
  test('label options panel shows category dropdown', async () => {
    // Create doc + section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Category Edit Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // Create a tag via Edit tab
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Editable Tag');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    // Type content and annotate it with the tag
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Editable text', { delay: 20 });
    await page.keyboard.press('Meta+A');
    await expect(page.locator('.selection-toolbar')).toBeVisible();
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const tagModal = page.locator('.modal');
    await tagModal.locator('.autocomplete input.input').fill('Editable Tag');
    await tagModal.locator('.autocomplete-item', { hasText: 'Editable Tag' }).first().click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });

    // Switch to Info tab — tag should appear via annotations
    await page.locator('.sidebar-tab', { hasText: 'Info' }).click();
    await page.locator('.label-item', { hasText: 'Editable Tag' }).click();

    // Should show category dropdown with "Category" label
    await expect(page.locator('.label-options-panel .input-label', { hasText: 'Category' })).toBeVisible();
    await expect(page.locator('.label-options-panel select.input')).toBeVisible();
  });
});

// ─── Deleting a tag ──────────────────────────────────────────────────

test.describe('Deleting a tag', () => {
  test('removes its highlights from the text immediately', async () => {
    // Reported by a user: deleting a tag left its highlights behind until the
    // highlighted text itself was deleted. The annotations were cascaded away in
    // the database, but the editor kept rendering them from memory.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Highlight Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('The dragon guards the gate', { delay: 20 });

    // Tag a selection.
    await page.keyboard.press('Meta+A');
    await expect(page.locator('.selection-toolbar')).toBeVisible();
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Dragon');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });

    // Find the tag in the left sidebar (searching auto-expands its category).
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('Dragon');
    const sidebarTag = page.locator('.tag-tree-item', { hasText: 'Dragon' }).first();
    await expect(sidebarTag).toBeVisible();

    // Delete it, accepting the confirmation.
    page.once('dialog', d => d.accept());
    await sidebarTag.click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Delete' }).click();

    // Sanity: the tag really is gone, so the assertion below is about highlights.
    await expect(page.locator('.tag-tree-item', { hasText: 'Dragon' })).toHaveCount(0);

    // The highlight must go away without reloading or touching the text.
    await expect(page.locator('.annotation-highlight')).toHaveCount(0);
    await expect(editor).toContainText('The dragon guards the gate');
  });
});

test.describe('Working with an existing highlight', () => {
  /** Doc + section + a highlight over the first sentence. */
  async function setup() {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Highlight Ops');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Gura was born in Atlantis.', { delay: 15 });

    // Drag-select the sentence, the way a user would.
    const p = (await editor.locator('p').first().boundingBox())!;
    await page.mouse.move(p.x + 2, p.y + p.height / 2);
    await page.mouse.down();
    await page.mouse.move(p.x + p.width + 40, p.y + p.height / 2, { steps: 8 });
    await page.mouse.up();

    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('GURA');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
    return editor;
  }

  test('Remove annotation actually removes it', async () => {
    // Reported as "none of these work". Opening the menu also opened the tag popup,
    // whose click-outside handler cleared the active annotation on mousedown — before
    // the menu item's click handler ran, so every action was a no-op.
    const editor = await setup();

    await page.locator('.annotation-highlight').click({ button: 'right' });
    await expect(page.locator('.context-menu')).toBeVisible();
    await page.locator('.context-menu-item', { hasText: 'Remove annotation' }).click();

    await expect(page.locator('.annotation-highlight')).toHaveCount(0);
    await expect(editor).toContainText('Gura was born in Atlantis.');
  });

  /** Put the caret after the last character by clicking past the end of the line. */
  async function caretToEndOfLine() {
    const box = await page.locator('.annotation-highlight').first().boundingBox();
    await page.mouse.click(box!.x + box!.width + 30, box!.y + box!.height / 2);
    await page.waitForTimeout(150);
  }

  test('typing after a highlight does not extend it', async () => {
    // Reported as "it stays conjoined" — the next sentence was swallowed by the
    // previous sentence's highlight.
    const editor = await setup();
    await caretToEndOfLine();
    await editor.pressSequentially(' She later moved away.', { delay: 15 });
    await page.waitForTimeout(1400); // let the debounced save settle

    const after = await page.locator('.annotation-highlight').allTextContents();
    expect(after).toEqual(['Gura was born in Atlantis.']);
    await expect(editor).toContainText('She later moved away.');
  });

  test('a select-all highlight also stops at the text', async () => {
    // Select-all yields a range covering the paragraph's own boundaries, so the
    // annotation used to end past the last character and grew on every keystroke no
    // matter what inclusiveEnd said.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Select All');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Gura was born in Atlantis.', { delay: 15 });
    await page.keyboard.press('Meta+A');
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('GURA');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });

    await caretToEndOfLine();
    await editor.pressSequentially(' She later moved away.', { delay: 15 });
    await page.waitForTimeout(1400);

    expect(await page.locator('.annotation-highlight').allTextContents())
      .toEqual(['Gura was born in Atlantis.']);
  });
});

test.describe('Tagging a selection', () => {
  test('shows the tag list, not a create-from-sentence row', async () => {
    // Reported by a user: selecting a sentence pre-filled it into the tag search
    // box, so the tag list vanished behind `+ Create "<the whole sentence>"`.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Picker Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // Two tags to pick from.
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    for (const name of ['GURA', 'PEKORA']) {
      await page.locator('.btn', { hasText: '+ New Tag' }).click();
      await page.locator('.modal input.input').first().fill(name);
      await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
      await expect(page.locator('.badge', { hasText: name })).toBeVisible();
    }

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Wild rabbits ran amok in Libestal.', { delay: 15 });
    await page.keyboard.press('Meta+A');
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();

    const modal = page.locator('.modal');
    // The search box starts empty and both tags are offered.
    await expect(modal.locator('.autocomplete input.input')).toHaveValue('');
    await expect(modal.locator('.autocomplete-item', { hasText: 'GURA' })).toBeVisible();
    await expect(modal.locator('.autocomplete-item', { hasText: 'PEKORA' })).toBeVisible();
    await expect(modal.locator('.autocomplete-item-create')).toHaveCount(0);

    // And there is an explicit way to make a new tag.
    await expect(modal.locator('.create-tag-btn')).toBeVisible();
    await modal.locator('.create-tag-btn').click();
    await expect(modal).toContainText('Create New Tag');
  });
});

// ─── Context Menu ─────────────────────────────────────────────────────

test.describe('Context Menu', () => {
  test('right-click on selected text shows context menu', async () => {
    // Create doc + section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Context Menu Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // Type content
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Right-click me for a context menu', { delay: 20 });

    // Select all text
    await page.keyboard.press('Meta+A');

    // Right-click on the selected text
    await editor.click({ button: 'right' });

    // Context menu should appear
    await expect(page.locator('.context-menu')).toBeVisible();
    await expect(page.locator('.context-menu-item')).toContainText('Add tag to selection');
  });
});
