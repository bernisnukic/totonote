import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks, acceptConfirm } from './fixtures';

// Browse sidebar, toolbar and editing settings

let app: ElectronApplication;
let page: Page;
registerAppHooks(h => {
  app = h.app;
  page = h.page;
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

  test('shows sidebar mode bar with Search/Sort/Filter/Highlights', async () => {
    const modeBar = page.locator('.sidebar-mode-bar');
    await expect(modeBar).toBeVisible();

    const buttons = modeBar.locator('.sidebar-mode-btn');
    await expect(buttons).toHaveCount(4);
    await expect(buttons.nth(0)).toHaveText('Search');
    await expect(buttons.nth(1)).toHaveText('Sort');
    await expect(buttons.nth(2)).toHaveText('Filter');
    await expect(buttons.nth(3)).toHaveText('Highlights');
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

  test('sort mode shows excerpt sort options', async () => {
    await page.locator('.sidebar-mode-btn', { hasText: 'Sort' }).click();

    const sortBtns = page.locator('.sidebar-sort-btn');
    await expect(sortBtns).toHaveCount(4);
    await expect(sortBtns.nth(0)).toHaveText('Document order');
    await expect(sortBtns.nth(1)).toHaveText('Newest first');
    await expect(sortBtns.nth(2)).toHaveText('Oldest first');
    await expect(sortBtns.nth(3)).toHaveText('Grouped by tag');
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
    await page.locator('.sidebar-mode-btn', { hasText: 'Highlights' }).click();
    await expect(page.locator('.sidebar-highlight-toggle')).toBeVisible();
    await expect(page.locator('.sidebar-highlight-toggle')).toContainText('Show all highlights');
  });
});

// ─── Sidebar UX ──────────────────────────────────────────────────────

test.describe('Sidebar UX', () => {
  /** Doc with two sections, a tag, and one highlight in the first section. */
  async function setup() {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('UX Test');
    await page.locator('.modal .btn-primary').click();
    for (const title of ['First', 'Second']) {
      await page.locator('.tab-add').click();
      await page.locator('.modal input.input').first().fill(title);
      await page.locator('.modal .btn-primary').click();
    }

    // Creating a section arms a 600ms scroll guard that ignores focus changes;
    // wait it out so clicking into the first section really activates it.
    await page.waitForTimeout(700);
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('The dragon sleeps here', { delay: 15 });
    await page.keyboard.press('ControlOrMeta+A');
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Dragon');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
  }

  test('clicking anywhere on a filter row toggles it, and opens the reading view', async () => {
    await setup();
    await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();

    // Click the tag name — previously that opened details instead of filtering.
    await page.locator('.sidebar-filter-item span', { hasText: 'Dragon' }).click();
    await expect(page.locator('.sidebar-filter-item input[type="checkbox"]')).toBeChecked();

    // The main page switches to the filtered reading view.
    await expect(page.locator('.filtered-view')).toBeVisible();

    // The details affordance still exists, as its own button.
    await page.locator('.tag-details-btn').click();
    await expect(page.locator('.right-sidebar')).toContainText('Usage');
  });

  test('Filter collapses the page to only the ticked tags\' excerpts', async () => {
    // Two sections; tag each with a different tag.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Filter View');
    await page.locator('.modal .btn-primary').click();
    for (const t of ['S1', 'S2']) {
      await page.locator('.tab-add').click();
      await page.locator('.modal input.input').first().fill(t);
      await page.locator('.modal .btn-primary').click();
      await page.waitForTimeout(500);
    }
    await page.locator('.tiptap').nth(0).click();
    await page.locator('.tiptap').nth(0).pressSequentially('The dragon sleeps here', { delay: 15 });
    await page.locator('.tiptap').nth(1).click();
    await page.locator('.tiptap').nth(1).pressSequentially('A hoard of gold', { delay: 15 });

    const tagSection = async (idx: number, title: string, tag: string) => {
      // Switch via the tab and wait out the scroll guard so activeSection is this one
      // before we tag — otherwise the annotation can land in the previous section.
      await page.locator('.section-tab', { hasText: title }).click();
      await page.waitForTimeout(750);
      await page.locator('.tiptap').nth(idx).click();
      await page.keyboard.press('ControlOrMeta+A');
      await expect(page.locator('.selection-toolbar')).toBeVisible();
      await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
      const modal = page.locator('.modal');
      await modal.locator('.autocomplete input.input').fill(tag);
      await modal.locator('.autocomplete-item-create').click();
      await modal.locator('.btn-primary', { hasText: 'Create' }).click();
      await page.waitForTimeout(400);
    };
    await tagSection(0, 'S1', 'Dragon');
    await tagSection(1, 'S2', 'Gold');

    // Filter to Dragon — the reading view shows only that excerpt; untagged text gone.
    await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();
    await page.locator('.sidebar-filter-item', { hasText: 'Dragon' })
      .locator('input[type="checkbox"]').check();

    const view = page.locator('.filtered-view');
    await expect(view).toBeVisible();
    await expect(view.locator('.filtered-excerpt')).toHaveCount(1);
    await expect(view.locator('.filtered-excerpt')).toContainText('The dragon sleeps here');
    await expect(view).not.toContainText('hoard of gold');

    // Add Gold — both excerpts now show (multiple tags at once).
    await page.locator('.sidebar-filter-item', { hasText: 'Gold' })
      .locator('input[type="checkbox"]').check();
    await expect(view.locator('.filtered-excerpt')).toHaveCount(2);

    // Double-clicking an excerpt clears the filter and returns to the editor.
    await view.locator('.filtered-excerpt').first().dblclick();
    await expect(page.locator('.filtered-view')).toHaveCount(0);
    await expect(page.locator('.tiptap').first()).toBeVisible();
  });

  test('HL mode can hide one tag’s highlights without touching the rest', async () => {
    await setup();
    // A second tag on different text (the other section), so one highlight remains
    // visible while the first is hidden.
    const editor2 = page.locator('.tiptap').nth(1);
    await editor2.click();
    await editor2.pressSequentially('A lair beneath the mountain', { delay: 15 });
    await expect(editor2).toContainText('A lair beneath the mountain');
    await page.keyboard.press('ControlOrMeta+A');
    // Wait for the floating toolbar rather than racing it — under full-suite load the
    // selection can take a moment to register.
    await expect(page.locator('.selection-toolbar')).toBeVisible();
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Lair');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toHaveCount(2);

    await page.locator('.sidebar-mode-btn', { hasText: 'Highlights' }).click();
    const dragonRow = page.locator('.sidebar-highlight-item', { hasText: 'Dragon' });
    await dragonRow.locator('input[type="checkbox"]').uncheck();

    // Dragon's highlight is gone; Lair's survives.
    await expect(page.locator('.annotation-highlight')).toHaveCount(1);
    await expect(page.locator('.annotation-highlight')).toContainText('A lair beneath');

    await dragonRow.locator('input[type="checkbox"]').check();
    await expect(page.locator('.annotation-highlight')).toHaveCount(2);
  });

  test('tag edits save themselves — no Save button, survives a tab switch', async () => {
    await setup();
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('Dragon');
    await page.locator('.tag-tree-item', { hasText: 'Dragon' }).first().click();

    const panel = page.locator('.label-options-panel');
    await expect(panel).toContainText('Changes save automatically');
    await expect(panel.locator('.btn', { hasText: 'Save' })).toHaveCount(0);

    // Rename, then switch tabs immediately — the flush must catch it.
    await panel.locator('input.input').first().fill('Wyrm');
    await page.locator('.sidebar-tab', { hasText: 'Arrange' }).click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await expect(page.locator('.badge', { hasText: 'Wyrm' })).toBeVisible();
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
    // The toolbar has sidebar toggles, the graph button and settings
    const toolbarBtns = page.locator('.toolbar-group').last().locator('.toolbar-btn');
    // left sidebar, graph, timeline, right sidebar, settings
    await expect(toolbarBtns).toHaveCount(5);
    await expect(page.locator('.toolbar-btn[aria-label="Timeline"]')).toBeVisible();
  });

  test('settings gear button opens settings modal', async () => {
    // Click the settings (gear) button - last button in toolbar
    const settingsBtn = page.locator('.toolbar-group').last().locator('.toolbar-btn').last();
    await settingsBtn.click();

    // Settings modal should open
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal-title')).toHaveText('Settings');

    // Appearance: four themes plus the option to follow the OS.
    await expect(page.locator('.settings-section-title').first()).toHaveText('Appearance');
    await expect(page.locator('.theme-card')).toHaveCount(5);
    await expect(page.locator('.theme-card', { hasText: 'System' })).toBeVisible();

    // Should contain Keyboard Shortcuts section
    // The sections that hold the app's own behaviour, in the order they appear.
    for (const section of ['Startup', 'Editing', 'History', 'Storage', 'Keyboard Shortcuts']) {
      await expect(page.locator('.modal')).toContainText(section);
    }
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

// ─── v1.7.0: Sort view and pop-out wiki ────────────────────────────────

test.describe('Sort view and pop-out wiki', () => {
  // Create a document with one section, type a line, and tag the whole line with a new tag.
  async function taggedDoc(tagName: string, text: string) {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Sort & Wiki');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially(text, { delay: 15 });

    await page.keyboard.press('ControlOrMeta+A');
    await expect(page.locator('.selection-toolbar')).toBeVisible();
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await modal.locator('.autocomplete input.input').fill(tagName);
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
  }

  test('Sort tab lists every tagged excerpt, regroups, and double-click jumps back', async () => {
    await taggedDoc('Hero', 'The hero crossed the frozen sea.');

    // Open the Sort tab — the main page becomes a reading list of excerpts.
    await page.locator('.sidebar-mode-btn', { hasText: 'Sort' }).click();
    const view = page.locator('.filtered-view');
    await expect(view).toBeVisible();
    await expect(view.locator('.filtered-excerpt')).toHaveCount(1);
    await expect(view.locator('.filtered-excerpt__text')).toContainText('frozen sea');
    // In document order the tag name rides on each excerpt.
    await expect(view.locator('.filtered-excerpt__tag')).toContainText('Hero');

    // "Grouped by tag" gathers excerpts under a tag heading.
    await page.locator('.sidebar-sort-btn', { hasText: 'Grouped by tag' }).click();
    await expect(view.locator('.filtered-view__section .section-header', { hasText: 'Hero' })).toBeVisible();

    // Double-click an excerpt to leave the Sort view and land back in the editor.
    await view.locator('.filtered-excerpt').first().dblclick();
    await expect(page.locator('.filtered-view')).toHaveCount(0);
    await expect(page.locator('.editor-wrapper .tiptap').first()).toBeVisible();
  });

  test('a tag page pops out full-screen and Escape closes it', async () => {
    await taggedDoc('Relic', 'A relic older than the gods.');

    // The focused-tag *page* (the thing that pops out) is opened from the left sidebar, not
    // the Info tab's inline list. Put the right sidebar on Info, then open the tag's page
    // via its details button in Filter mode.
    await page.locator('.sidebar-tab', { hasText: 'Info' }).click();
    await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();
    const row = page.locator('.sidebar-filter-item', { hasText: 'Relic' });
    await expect(row).toBeVisible();
    await row.locator('.tag-details-btn').click();

    // The focused page carries a pop-out button; clicking it opens the full-screen wiki.
    const popout = page.locator('button[aria-label="Open as full page"]');
    await expect(popout).toBeVisible();
    await popout.click();

    const overlay = page.locator('.wiki-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Relic');

    // Exactly one close button in the pop-out — the overlay's own. The page's inner close
    // and pop-out controls are hidden while popped out (they used to double up).
    await expect(overlay.locator('.help-close')).toHaveCount(1);
    await expect(overlay.locator('button[aria-label="Open as full page"]')).toHaveCount(0);

    // Escape drops back to the sidebar (the page stays focused underneath).
    await page.keyboard.press('Escape');
    await expect(page.locator('.wiki-overlay')).toHaveCount(0);
  });
});

// ─── v1.7.1: Sort/filter precedence and section deletion ───────────────

test.describe('Sort precedence and section deletion', () => {
  // A document with two sections, each carrying one tagged word.
  async function twoTaggedSections() {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Section Fixes');
    await page.locator('.modal .btn-primary').click();
    for (const t of ['S1', 'S2']) {
      await page.locator('.tab-add').click();
      await page.locator('.modal input.input').first().fill(t);
      await page.locator('.modal .btn-primary').click();
      await page.waitForTimeout(400);
    }
    await page.locator('.tiptap').nth(0).click();
    await page.locator('.tiptap').nth(0).pressSequentially('The dragon sleeps here', { delay: 15 });
    await page.locator('.tiptap').nth(1).click();
    await page.locator('.tiptap').nth(1).pressSequentially('A hoard of gold', { delay: 15 });

    const tagSection = async (idx: number, title: string, tag: string) => {
      await page.locator('.section-tab', { hasText: title }).click();
      await page.waitForTimeout(750);
      await page.locator('.tiptap').nth(idx).click();
      await page.keyboard.press('ControlOrMeta+A');
      await expect(page.locator('.selection-toolbar')).toBeVisible();
      await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
      const modal = page.locator('.modal');
      await modal.locator('.autocomplete input.input').fill(tag);
      await modal.locator('.autocomplete-item-create').click();
      await modal.locator('.btn-primary', { hasText: 'Create' }).click();
      await page.waitForTimeout(400);
    };
    await tagSection(0, 'S1', 'Dragon');
    await tagSection(1, 'S2', 'Gold');
  }

  test('Sort shows all excerpts even when a filter is ticked', async () => {
    await twoTaggedSections();

    // Tick a single filter — the page narrows to just that tag's excerpt.
    await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();
    await page.locator('.sidebar-filter-item', { hasText: 'Dragon' })
      .locator('input[type="checkbox"]').check();
    const view = page.locator('.filtered-view');
    await expect(view.locator('.filtered-excerpt')).toHaveCount(1);

    // Switching to Sort must show *every* excerpt, not stay stuck on the filtered one.
    await page.locator('.sidebar-mode-btn', { hasText: 'Sort' }).click();
    await expect(view).toBeVisible();
    await expect(view.locator('.filtered-excerpt')).toHaveCount(2);
  });

  test('deleting a section drops its tag from the usage count', async () => {
    await twoTaggedSections();

    // In Filter mode the Gold tag shows a usage badge of 1 (its one excerpt in S2).
    await page.locator('.sidebar-mode-btn', { hasText: 'Filter' }).click();
    const goldRow = page.locator('.sidebar-filter-item', { hasText: 'Gold' });
    await expect(goldRow.locator('.tag-usage-badge')).toHaveText('1');

    // Delete S2 (accept the confirmation). Its annotation goes with it.
    await page.locator('.section-tab', { hasText: 'S2' }).locator('.tab-close').click();
    await acceptConfirm(page);

    // The count must fall to zero — the badge disappears — rather than lingering stale.
    await expect(goldRow.locator('.tag-usage-badge')).toHaveCount(0);
  });
});

// ─── v1.9.0: undo, manual save, collapse/expand ────────────────────────

test.describe('Editing settings and undo', () => {
  async function docWithSection() {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Editing Settings');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.tiptap')).toBeVisible();
  }

  test('Cmd+Z undoes editor typing (via the Edit menu command)', async () => {
    await docWithSection();
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Undo me please', { delay: 20 });
    await expect(editor).toContainText('Undo me please');

    // The menu forwards Undo to the focused editor (role:'undo' would miss ProseMirror).
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('menu:undo'),
    );
    await expect(editor).not.toContainText('Undo me please');
  });

  test('turning off auto-save requires a manual save', async () => {
    await docWithSection();

    // Turn auto-save off in Settings.
    await page.locator('.toolbar-btn[aria-label="Settings"]').click();
    await page.locator('input[aria-label="Auto-save"]').uncheck();
    await page.locator('.modal .btn-primary', { hasText: 'Done' }).click();

    // Type — the status bar should flag unsaved work with a Save button.
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Held until I save', { delay: 20 });
    const saveBtn = page.locator('.status-save-btn');
    await expect(saveBtn).toBeVisible();

    // Saving clears the unsaved flag.
    await saveBtn.click();
    await expect(saveBtn).toHaveCount(0);

    // And the content really persisted: navigate away and back.
    await page.locator('.toolbar-back-btn').click();
    await page.locator('.document-card', { hasText: 'Editing Settings' }).click();
    await expect(page.locator('.tiptap').first()).toContainText('Held until I save');
  });

  // Regression: leaving a document used to tear the editors down without flushing, so
  // unsaved work in manual-save mode was silently destroyed. Leaving now saves.
  test('leaving a document with auto-save off keeps the unsaved work', async () => {
    await docWithSection();
    await page.locator('.toolbar-btn[aria-label="Settings"]').click();
    await page.locator('input[aria-label="Auto-save"]').uncheck();
    await page.locator('.modal .btn-primary', { hasText: 'Done' }).click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Precious unsaved words', { delay: 15 });
    await expect(page.locator('.status-save-btn')).toBeVisible();

    // Go Back WITHOUT pressing Save.
    await page.locator('.toolbar-back-btn').click();
    await expect(page.locator('.home-title')).toBeVisible();

    // Reopening must still show the text.
    await page.locator('.document-card', { hasText: 'Editing Settings' }).click();
    await expect(page.locator('.tiptap').first()).toContainText('Precious unsaved words');
    // And nothing is left marked unsaved.
    await expect(page.locator('.status-save-btn')).toHaveCount(0);
  });

  test('switching documents with auto-save off keeps the unsaved work', async () => {
    await docWithSection();
    await page.locator('.toolbar-btn[aria-label="Settings"]').click();
    await page.locator('input[aria-label="Auto-save"]').uncheck();
    await page.locator('.modal .btn-primary', { hasText: 'Done' }).click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Words in the first document', { delay: 15 });
    await expect(page.locator('.status-save-btn')).toBeVisible();

    // Make a second document and open it — the switch tears down the first one's editors.
    await page.locator('.toolbar-back-btn').click();
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Second Doc');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.toolbar-back-btn').click();

    // Back in the first document, the text survived.
    await page.locator('.document-card', { hasText: 'Editing Settings' }).click();
    await expect(page.locator('.tiptap').first()).toContainText('Words in the first document');
  });

  test('Search tab can expand and collapse all categories', async () => {
    await docWithSection();
    // Make a tag so there's a category with a child to expand.
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: 'New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Griffin');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();

    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    const expandAll = page.locator('.sidebar-tree-action');
    await expect(expandAll).toContainText('Expand all');
    await expandAll.click();
    await expect(page.locator('.tag-tree-name', { hasText: 'Griffin' })).toBeVisible();

    // Now it offers to collapse, and doing so hides the tags.
    await expect(expandAll).toContainText('Collapse all');
    await expandAll.click();
    await expect(page.locator('.tag-tree-name', { hasText: 'Griffin' })).toHaveCount(0);
  });

  test('History tab restores an earlier checkpoint', async () => {
    await docWithSection();
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Alpha', { delay: 20 });
    await page.waitForTimeout(1400); // let the checkpoint debounce (1200ms) fire
    await editor.pressSequentially(' Beta', { delay: 20 });
    await page.waitForTimeout(1400);

    // The History tab lists multiple checkpoints.
    await page.locator('.sidebar-tab', { hasText: 'History' }).click();
    expect(await page.locator('.history-item').count()).toBeGreaterThan(1);

    // Restore the "Alpha" checkpoint (anchored, so it isn't the "Alpha Beta" one).
    await page
      .locator('.history-item', { has: page.locator('.history-item-preview', { hasText: /^Alpha$/ }) })
      .click();

    // The section rolls back — "Beta" is gone.
    await expect(editor).toContainText('Alpha');
    await expect(editor).not.toContainText('Beta');
  });
});
