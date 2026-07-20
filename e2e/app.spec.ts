import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const ROOT = path.resolve(__dirname, '..');

let app: ElectronApplication;
let page: Page;
let testDbPath: string;

test.beforeAll(async () => {
  // Create a temp DB for this test run
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'totonote-e2e-'));
  testDbPath = path.join(tmpDir, 'test.db');
});

test.beforeEach(async () => {
  // Remove DB from previous test to start fresh
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  app = await electron.launch({
    args: [path.join(ROOT, '.vite/build/index.js')],
    env: {
      ...process.env,
      TOTONOTE_DB_PATH: testDbPath,
      NODE_ENV: 'test',
    },
  });

  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait for React to mount
  await page.waitForSelector('.app-container', { timeout: 10000 });
});

test.afterEach(async () => {
  if (app) await app.close();
});

test.afterAll(async () => {
  // Clean up temp DB
  if (testDbPath && fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
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
    await page.keyboard.press('Meta+A');

    // Click Bold button
    const boldBtn = page.locator('.toolbar-btn', { hasText: 'B' }).first();
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

  test('right sidebar shows Info/Arrange/Edit tabs', async () => {
    const tabs = page.locator('.sidebar-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText('Info');
    await expect(tabs.nth(1)).toHaveText('Arrange');
    await expect(tabs.nth(2)).toHaveText('Edit');
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

// ─── Left Sidebar ─────────────────────────────────────────────────────

test.describe('Left Sidebar', () => {
  test.beforeEach(async () => {
    // Create doc and open it
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Sidebar Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();
  });

  test('shows sidebar mode bar with Search/Sort/Filter/HL', async () => {
    const modeBar = page.locator('.sidebar-mode-bar');
    await expect(modeBar).toBeVisible();

    const buttons = modeBar.locator('.sidebar-mode-btn');
    await expect(buttons).toHaveCount(4);
    await expect(buttons.nth(0)).toHaveText('Search');
    await expect(buttons.nth(1)).toHaveText('Sort');
    await expect(buttons.nth(2)).toHaveText('Filter');
    await expect(buttons.nth(3)).toHaveText('HL');
  });

  test('search mode shows search input', async () => {
    // Search mode is the default
    await expect(page.locator('.sidebar-search-input')).toBeVisible();
  });

  test('search shows category tree with matching tags', async () => {
    // Create a tag first
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Dragon');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.badge', { hasText: 'Dragon' })).toBeVisible();

    // Search for the tag — category should auto-expand
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('Dragon');
    await expect(page.locator('.tag-tree-name', { hasText: 'Dragon' })).toBeVisible();
  });

  test('default fuzzy search matches similar words', async () => {
    // Create tags "irys" and "fire"
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('irys');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('fire');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    // Default (fuzzy): "iris" should match "irys" (1 edit distance)
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('iris');
    await expect(page.locator('.tag-tree-name', { hasText: 'irys' })).toBeVisible();

    // Enable exact match: "iris" should NOT match "irys" (no substring match)
    await page.locator('.sidebar-exact-toggle').click();
    await expect(page.locator('.sidebar-exact-toggle')).toHaveClass(/active/);
    await expect(page.locator('.tag-tree-name')).toHaveCount(0);

    // Exact match: "iry" should match "irys" (contains)
    await page.locator('.sidebar-search-input').fill('iry');
    await expect(page.locator('.tag-tree-name', { hasText: 'irys' })).toBeVisible();

    // Disable exact: back to fuzzy
    await page.locator('.sidebar-exact-toggle').click();
    await expect(page.locator('.sidebar-exact-toggle')).not.toHaveClass(/active/);
    await page.locator('.sidebar-search-input').fill('iris');
    await expect(page.locator('.tag-tree-name', { hasText: 'irys' })).toBeVisible();
  });

  test('exact match does strict substring matching', async () => {
    // Create tags "Fire" and "Firebird"
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Fire');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Firebird');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    // Enable exact match
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-exact-toggle').click();

    // "Fire" contains-matches both "Fire" and "Firebird"
    await page.locator('.sidebar-search-input').fill('Fire');
    await expect(page.locator('.tag-tree-name')).toHaveCount(2);

    // "Firebird" only matches "Firebird"
    await page.locator('.sidebar-search-input').fill('Firebird');
    await expect(page.locator('.tag-tree-name')).toHaveCount(1);
    await expect(page.locator('.tag-tree-name')).toHaveText('Firebird');
  });

  test('sort mode shows sort options', async () => {
    await page.locator('.sidebar-mode-btn', { hasText: 'Sort' }).click();

    const sortBtns = page.locator('.sidebar-sort-btn');
    await expect(sortBtns).toHaveCount(4);
    await expect(sortBtns.nth(0)).toHaveText('Name A-Z');
    await expect(sortBtns.nth(1)).toHaveText('Name Z-A');
    await expect(sortBtns.nth(2)).toHaveText('Date (Oldest)');
    await expect(sortBtns.nth(3)).toHaveText('Date (Newest)');
  });

  test('filter mode shows categories and tags', async () => {
    // Create a tag first
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Test Tag');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    // Switch to Filter mode
    await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();

    // Should show the tag as a filter option
    await expect(page.locator('.sidebar-filter-item')).toHaveCount(1);
    await expect(page.locator('.sidebar-filter-item')).toContainText('Test Tag');
  });

  test('highlight mode shows toggle', async () => {
    await page.locator('.sidebar-mode-btn', { hasText: 'HL' }).click();
    await expect(page.locator('.sidebar-highlight-toggle')).toBeVisible();
    await expect(page.locator('.sidebar-highlight-toggle')).toContainText('Show all highlights');
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

// ─── Toolbar ──────────────────────────────────────────────────────────

test.describe('Toolbar', () => {
  test.beforeEach(async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Toolbar Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();
  });

  test('sidebar toggle buttons are visible', async () => {
    // The toolbar has sidebar toggle and settings buttons
    const toolbarBtns = page.locator('.toolbar-group').last().locator('.toolbar-btn');
    await expect(toolbarBtns).toHaveCount(3); // left sidebar, right sidebar, settings
  });

  test('settings gear button opens settings modal', async () => {
    // Click the settings (gear) button - last button in toolbar
    const settingsBtn = page.locator('.toolbar-group').last().locator('.toolbar-btn').last();
    await settingsBtn.click();

    // Settings modal should open
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal-title')).toHaveText('Settings');

    // Should contain Appearance section with theme cards
    await expect(page.locator('.settings-section-title').first()).toHaveText('Appearance');
    await expect(page.locator('.theme-card')).toHaveCount(4);

    // Should contain Keyboard Shortcuts section
    await expect(page.locator('.modal')).toContainText('Keyboard Shortcuts');
    await expect(page.locator('.shortcut-row')).toHaveCount(12); // 12 default shortcuts
  });

  test('can toggle left sidebar visibility', async () => {
    const leftSidebar = page.locator('.left-sidebar');
    await expect(leftSidebar).toBeVisible();

    // Click the first sidebar toggle
    const toggleBtn = page.locator('.toolbar-group').last().locator('.toolbar-btn').first();
    await toggleBtn.click();

    // Left sidebar should be collapsed
    await expect(leftSidebar).toHaveClass(/collapsed/);

    // Toggle again
    await toggleBtn.click();
    await expect(leftSidebar).not.toHaveClass(/collapsed/);
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

// ─── Theme Switching ─────────────────────────────────────────────────

test.describe('Theme Switching', () => {
  test.beforeEach(async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Theme Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();
  });

  test('defaults to dark theme', async () => {
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe('dark');
  });

  test('switches to each theme via settings modal', async () => {
    // Open settings
    const settingsBtn = page.locator('.toolbar-group').last().locator('.toolbar-btn').last();
    await settingsBtn.click();
    await expect(page.locator('.modal')).toBeVisible();

    // Dark should be active by default
    const darkCard = page.locator('.theme-card', { hasText: 'Dark' });
    await expect(darkCard).toHaveClass(/active/);

    // Switch to Light
    await page.locator('.theme-card', { hasText: 'Light' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    await expect(page.locator('.theme-card', { hasText: 'Light' })).toHaveClass(/active/);

    // Switch to Wood
    await page.locator('.theme-card', { hasText: 'Wood' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('wood');
    await expect(page.locator('.theme-card', { hasText: 'Wood' })).toHaveClass(/active/);

    // Switch to Black
    await page.locator('.theme-card', { hasText: 'Black' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('black');
    await expect(page.locator('.theme-card', { hasText: 'Black' })).toHaveClass(/active/);
  });

  test('theme persists after closing and reopening settings', async () => {
    // Open settings and switch to light
    const settingsBtn = page.locator('.toolbar-group').last().locator('.toolbar-btn').last();
    await settingsBtn.click();
    await page.locator('.theme-card', { hasText: 'Light' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');

    // Close modal
    await page.locator('.modal .btn-primary', { hasText: 'Done' }).click();
    await expect(page.locator('.modal')).not.toBeVisible();

    // Theme should still be light
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');

    // Reopen settings — Light card should be active
    await settingsBtn.click();
    await expect(page.locator('.theme-card', { hasText: 'Light' })).toHaveClass(/active/);
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

test.describe('Category dropdowns', () => {
  test('indent nested categories in the tag-a-selection prompt', async () => {
    // Reported by a user: the sidebar's category dropdown indented sub-categories
    // but the one in "Add Tag to Selection" listed them flat.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Indent Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // A nested category: CHARACTERS > GURA.
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('CHARACTERS');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await page.locator('.category-row', { hasText: 'CHARACTERS' })
      .locator('.category-row-btn', { hasText: '+' }).click();
    await page.locator('.category-new-form input.input').fill('GURA');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.category-row', { hasText: 'GURA' })).toBeVisible();

    // Open the create-a-tag form from a text selection.
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Some text', { delay: 20 });
    await page.keyboard.press('Meta+A');
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Brand New Tag');
    await modal.locator('.autocomplete-item-create').click();

    // The nested category must be indented with non-breaking spaces.
    const labels = await modal.locator('select.input option').allTextContents();
    const gura = labels.find(l => l.includes('GURA'));
    const characters = labels.find(l => l.includes('CHARACTERS'));
    expect(gura?.startsWith('\u00A0')).toBe(true);
    expect(characters?.startsWith('\u00A0')).toBe(false);
  });
});

// ─── Category Rules ──────────────────────────────────────────────────

test.describe('Category Rules', () => {
  /** Open a document so the right sidebar's Edit tab is reachable. */
  async function openEditPanel() {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Rule Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
  }

  const row = (name: string) => page.locator('.category-row', { hasText: name });

  /**
   * The node wrapping a category row, which also holds its children. Reached via the
   * row's parent rather than by filtering `.category-node` — nodes nest, so a filter
   * would match every ancestor of the row as well.
   */
  const node = (name: string) => row(name).locator('..');

  async function createRootCategory(name: string) {
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill(name);
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await expect(row(name)).toBeVisible();
  }

  /** Create a sub-category via the row's "+" button. */
  async function createSubCategory(parent: string, name: string, applyRule = true) {
    await row(parent).locator('.category-row-btn', { hasText: '+' }).click();
    const form = page.locator('.category-new-form');
    await form.locator('input.input').fill(name);
    const checkbox = form.locator('.rule-checkbox input[type="checkbox"]');
    if (await checkbox.count()) {
      if (applyRule) await checkbox.check();
      else await checkbox.uncheck();
    }
    await form.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(row(name)).toBeVisible();
  }

  async function setRule(category: string, template: string) {
    await row(category).click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: /rule…/ }).click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await modal.locator('.rule-textarea').fill(template);
    await modal.locator('.btn-primary', { hasText: 'Save' }).click();
    await expect(modal).not.toBeVisible();
  }

  test.beforeEach(async () => {
    await openEditPanel();
  });

  test('saves a rule and shows how many sub-categories it creates', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY\nABILITIES\nCOLOUR PALETTE');

    await expect(row('CHARACTERS').locator('.rule-chip')).toHaveText('rule 3');
  });

  test('previews the rule tree as it is typed', async () => {
    await createRootCategory('CHARACTERS');
    await row('CHARACTERS').click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Create rule…' }).click();

    const modal = page.locator('.modal');
    await modal.locator('.rule-textarea').fill('HISTORY\nABILITIES\n  COMBAT');

    const preview = modal.locator('.rule-preview');
    await expect(preview).toContainText('new sub-category');
    await expect(preview).toContainText('HISTORY');
    await expect(preview).toContainText('COMBAT');
    await expect(modal.locator('.rule-preview-row')).toHaveCount(4); // root + 3 nodes
  });

  test('auto-creates the rule sub-categories under a new sub-category', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY\nABILITIES\nCOLOUR PALETTE');
    await createSubCategory('CHARACTERS', 'GURA');

    const gura = node('GURA');
    await expect(gura.locator('.category-row', { hasText: 'HISTORY' })).toBeVisible();
    await expect(gura.locator('.category-row', { hasText: 'ABILITIES' })).toBeVisible();
    await expect(gura.locator('.category-row', { hasText: 'COLOUR PALETTE' })).toBeVisible();
  });

  test('creates the same sub-category names again under a second sibling', async () => {
    // Category names used to be globally unique, which made this impossible.
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY\nABILITIES\nCOLOUR PALETTE');
    await createSubCategory('CHARACTERS', 'GURA');
    await createSubCategory('CHARACTERS', 'PEKORA');

    await expect(node('GURA').locator('.category-row', { hasText: 'HISTORY' })).toBeVisible();
    await expect(node('PEKORA').locator('.category-row', { hasText: 'HISTORY' })).toBeVisible();
    await expect(page.locator('.category-row', { hasText: 'HISTORY' })).toHaveCount(2);
  });

  test('skips the rule when the checkbox is unticked', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY\nABILITIES\nCOLOUR PALETTE');
    await createSubCategory('CHARACTERS', 'PLAIN', false);

    await expect(node('PLAIN').locator('.category-row')).toHaveCount(1);
    await expect(page.locator('.category-row', { hasText: 'HISTORY' })).toHaveCount(0);
  });

  test('creates nested sub-categories from an indented rule', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY\nABILITIES\n  COMBAT\n  MAGIC');
    await createSubCategory('CHARACTERS', 'GURA');

    const abilities = node('ABILITIES');
    await expect(abilities.locator('.category-row', { hasText: 'COMBAT' })).toBeVisible();
    await expect(abilities.locator('.category-row', { hasText: 'MAGIC' })).toBeVisible();
  });

  test('applies a rule retroactively to sub-categories that already exist', async () => {
    await createRootCategory('CHARACTERS');
    await createSubCategory('CHARACTERS', 'GURA');
    await createSubCategory('CHARACTERS', 'PEKORA');
    await expect(page.locator('.category-row', { hasText: 'HISTORY' })).toHaveCount(0);

    await setRule('CHARACTERS', 'HISTORY\nABILITIES');
    await row('CHARACTERS').click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Apply rule to existing' }).click();

    await expect(page.locator('.category-status')).toContainText('Added 4 sub-categories');
    await expect(node('GURA').locator('.category-row', { hasText: 'HISTORY' })).toBeVisible();
    await expect(node('PEKORA').locator('.category-row', { hasText: 'ABILITIES' })).toBeVisible();
  });

  test('retroactive apply is safe to run twice', async () => {
    await createRootCategory('CHARACTERS');
    await createSubCategory('CHARACTERS', 'GURA');
    await setRule('CHARACTERS', 'HISTORY\nABILITIES');

    for (let i = 0; i < 2; i++) {
      await row('CHARACTERS').click({ button: 'right' });
      await page.locator('.context-menu-item', { hasText: 'Apply rule to existing' }).click();
    }

    await expect(page.locator('.category-status')).toContainText('already matches');
    await expect(page.locator('.category-row', { hasText: 'HISTORY' })).toHaveCount(1);
  });

  test('edits an existing rule', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY');
    await expect(row('CHARACTERS').locator('.rule-chip')).toHaveText('rule 1');

    await row('CHARACTERS').locator('.rule-chip').click();
    const modal = page.locator('.modal');
    await expect(modal.locator('.rule-textarea')).toHaveValue('HISTORY');
    await modal.locator('.rule-textarea').fill('HISTORY\nABILITIES\nCOLOUR PALETTE');
    await modal.locator('.btn-primary', { hasText: 'Save' }).click();

    await expect(row('CHARACTERS').locator('.rule-chip')).toHaveText('rule 3');
  });

  test('removes a rule', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY');

    await row('CHARACTERS').locator('.rule-chip').click();
    await page.locator('.modal .btn-ghost', { hasText: 'Remove rule' }).click();

    await expect(row('CHARACTERS').locator('.rule-chip')).toHaveCount(0);
  });

  test('adds a sub-category to several categories at once', async () => {
    await createRootCategory('CHARACTERS');
    await createRootCategory('LOCATIONS');

    await page.locator('.btn', { hasText: 'Select' }).click();
    await row('CHARACTERS').locator('.category-select-box').check();
    await row('LOCATIONS').locator('.category-select-box').check();
    await expect(page.locator('.category-select-bar')).toContainText('2 selected');

    await page.locator('.btn', { hasText: 'Add sub-category…' }).click();
    const modal = page.locator('.modal');
    await modal.locator('input.input').fill('NOTES');
    await modal.locator('.btn-primary', { hasText: 'Add' }).click();

    await expect(page.locator('.category-status')).toContainText('Added "NOTES" to 2 categories');
    await expect(node('CHARACTERS').locator('.category-row', { hasText: 'NOTES' })).toBeVisible();
    await expect(node('LOCATIONS').locator('.category-row', { hasText: 'NOTES' })).toBeVisible();
  });

  test('bulk add reports categories that already had the sub-category', async () => {
    await createRootCategory('CHARACTERS');
    await createRootCategory('LOCATIONS');
    await createSubCategory('CHARACTERS', 'NOTES');

    await page.locator('.btn', { hasText: 'Select' }).click();
    await row('CHARACTERS').locator('.category-select-box').check();
    await row('LOCATIONS').locator('.category-select-box').check();
    await page.locator('.btn', { hasText: 'Add sub-category…' }).click();

    const modal = page.locator('.modal');
    await modal.locator('input.input').fill('NOTES');
    await modal.locator('.btn-primary', { hasText: 'Add' }).click();

    await expect(page.locator('.category-status')).toContainText('1 already had it (CHARACTERS)');
    await expect(page.locator('.category-row', { hasText: 'NOTES' })).toHaveCount(2);
  });

  test('rejects a duplicate sub-category name with a readable error', async () => {
    await createRootCategory('CHARACTERS');
    await createSubCategory('CHARACTERS', 'GURA');

    await row('CHARACTERS').locator('.category-row-btn', { hasText: '+' }).click();
    const form = page.locator('.category-new-form');
    await form.locator('input.input').fill('gura');
    await form.locator('.btn-primary', { hasText: 'Create' }).click();

    await expect(form.locator('.rule-error')).toContainText('already exists');
    await expect(page.locator('.category-row', { hasText: 'GURA' })).toHaveCount(1);
  });

  test('a rule only applies to direct children, not deeper descendants', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY');
    await createSubCategory('CHARACTERS', 'GURA');

    // HISTORY has no rule of its own, so its own children get nothing stamped.
    await row('HISTORY').locator('.category-row-btn', { hasText: '+' }).click();
    const form = page.locator('.category-new-form');
    await expect(form.locator('.rule-checkbox')).toHaveCount(0);
    await form.locator('input.input').fill('EARLY LIFE');
    await form.locator('.btn-primary', { hasText: 'Create' }).click();

    await expect(node('EARLY LIFE').locator('.category-row')).toHaveCount(1);
    await expect(page.locator('.category-row', { hasText: 'HISTORY' })).toHaveCount(1);
  });

  test('rules survive a restart', async () => {
    await createRootCategory('CHARACTERS');
    await setRule('CHARACTERS', 'HISTORY\nABILITIES');

    await page.reload();
    await page.waitForSelector('.app-container');
    await page.locator('.document-card', { hasText: 'Rule Test' }).click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();

    await expect(row('CHARACTERS').locator('.rule-chip')).toHaveText('rule 2');
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
