import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

// Documents, sections and the editor

let page: Page;
registerAppHooks(h => {
  page = h.page;
});

// ─── Document Management ──────────────────────────────────────────────

test.describe('Document Management', () => {
  test('shows empty document list on fresh start', async () => {
    await expect(page.locator('.home-title')).toHaveText('Documents');
    // Only the "new" card should be present
    await expect(page.locator('.document-card-new')).toBeVisible();
    await expect(page.locator('.document-card')).toHaveCount(0);
  });

  test('creates a new document', async () => {
    await page.locator('.document-card-new').click();

    // Fill in the modal
    await page.locator('.modal input.input').first().fill('Test Lore Document');
    await page.locator('.modal .btn-primary').click();

    // Should navigate to the editor
    await expect(page.locator('.main-toolbar')).toBeVisible();
    await expect(page.locator('.toolbar-back-btn')).toBeVisible();
    // Document title should appear in toolbar
    await expect(page.locator('.main-toolbar')).toContainText('Test Lore Document');
  });

  test('navigates back to document list', async () => {
    // Create a document first
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Back Test Doc');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.main-toolbar')).toBeVisible();

    // Click back
    await page.locator('.toolbar-back-btn').click();

    // Should see document list with the created document
    await expect(page.locator('.home-title')).toHaveText('Documents');
    await expect(page.locator('.document-card')).toHaveCount(1);
    await expect(page.locator('.document-card-title')).toHaveText('Back Test Doc');
  });

  test('opens an existing document', async () => {
    // Create a doc
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Open Test Doc');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.toolbar-back-btn').click();

    // Open it
    await page.locator('.document-card').click();

    await expect(page.locator('.main-toolbar')).toContainText('Open Test Doc');
  });
});

// ─── Section Management ───────────────────────────────────────────────

test.describe('Section Management', () => {
  test.beforeEach(async () => {
    // Create and open a document
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Section Test Doc');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.main-toolbar')).toBeVisible();
  });

  test('shows empty state when no sections exist', async () => {
    const editorEmpty = page.locator('.center-panel .empty-state');
    await expect(editorEmpty).toBeVisible();
    await expect(editorEmpty).toContainText('No sections yet');
  });

  test('creates a section via tab bar + button', async () => {
    // Click the + button in the tab bar
    await page.locator('.tab-add').click();

    // Fill in section title
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await modal.locator('input.input').first().fill('Chapter One');
    await modal.locator('.btn-primary').click();

    // Section tab should appear
    await expect(page.locator('.section-tab')).toHaveCount(1);
    // Editor should show the section
    await expect(page.locator('.section-header')).toContainText('Chapter One');
  });

  test('creates multiple sections and switches between them', async () => {
    // Create first section
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Part 1');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.section-tab')).toHaveCount(1);

    // Create second section
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Part 2');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.section-tab')).toHaveCount(2);

    // Both sections should be visible in the editor
    const headers = page.locator('.section-header');
    await expect(headers).toHaveCount(2);
    await expect(headers.first()).toContainText('Part 1');
    await expect(headers.last()).toContainText('Part 2');
  });
});

// ─── Editor ───────────────────────────────────────────────────────────

test.describe('Editor', () => {
  test.beforeEach(async () => {
    // Create doc with a section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Editor Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main Section');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();
  });

  test('can type content into the editor', async () => {
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Hello World', { delay: 30 });
    await expect(editor).toContainText('Hello World');
  });

  test('toolbar formatting buttons apply formatting', async () => {
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Bold text', { delay: 30 });

    // Select the text
    await page.keyboard.press('ControlOrMeta+A');

    // Click Bold button (icon-only now, so locate by its accessible name)
    const boldBtn = page.locator('.toolbar-btn[aria-label="Bold"]').first();
    await boldBtn.click();

    // Text should be wrapped in strong tags
    await expect(editor.locator('strong')).toContainText('Bold text');
  });

  test('content persists after navigating away and back', async () => {
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Persistent content', { delay: 30 });

    // Wait for debounced save
    await page.waitForTimeout(1500);

    // Navigate away
    await page.locator('.toolbar-back-btn').click();
    await expect(page.locator('.home-title')).toBeVisible();

    // Navigate back
    await page.locator('.document-card').click();
    await expect(page.locator('.tiptap')).toBeVisible();
    await expect(page.locator('.tiptap').first()).toContainText('Persistent content');
  });
});

// ─── Section Header ──────────────────────────────────────────────────

test.describe('Section Header', () => {
  test('section header shows title without prefix', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Header Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('My Chapter');
    await page.locator('.modal .btn-primary').click();

    const header = page.locator('.section-header');
    await expect(header).toHaveText('My Chapter');
  });
});

// ─── Section Tags ────────────────────────────────────────────────────

test.describe('Section Tags', () => {
  test.beforeEach(async () => {
    // Create doc with a section
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Section Tag Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();

    // Create a tag via Edit panel
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Location');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
  });

  test('section tag bar shows add button', async () => {
    await expect(page.locator('.section-tag-add-btn')).toBeVisible();
  });

  test('can add and remove a section tag', async () => {
    // Click + button to add section tag
    await page.locator('.section-tag-add-btn').click();

    // Autocomplete popover should appear
    await expect(page.locator('.section-tag-add-popover .autocomplete')).toBeVisible();

    // Click the "Location" tag
    await page.locator('.section-tag-add-popover .autocomplete-item', { hasText: 'Location' }).click();

    // Tag badge should appear
    await expect(page.locator('.section-tag-badge', { hasText: 'Location' })).toBeVisible();

    // Remove the tag
    await page.locator('.section-tag-badge .section-tag-remove').click();
    await expect(page.locator('.section-tag-badge')).toHaveCount(0);
  });
});

// ─── Status Bar ───────────────────────────────────────────────────────

test.describe('Status Bar', () => {
  test('status bar shows app name on home screen', async () => {
    // StatusBar uses inline styles, not a CSS class — find by text content
    await expect(page.getByText('TotoNote')).toBeVisible();
  });
});

// ─── Intro Animation ───────────────────────────────────────────────────

test.describe('Intro Animation', () => {
  test('intro overlay is skipped under automation so it never blocks the UI', async () => {
    // The intro plays on real launches but is disabled when navigator.webdriver
    // is true (Playwright), so the suite can interact with the app immediately.
    await expect(page.locator('.intro-overlay')).toHaveCount(0);
  });
});
