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
