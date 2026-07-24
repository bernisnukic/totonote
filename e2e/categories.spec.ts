import { test, expect, type Page } from '@playwright/test';
import { registerAppHooks } from './fixtures';

// Categories, rules, filing, the graph and workspaces

let page: Page;
registerAppHooks(h => {
  page = h.page;
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

// ─── Filing ──────────────────────────────────────────────────────────

test.describe('Filing excerpts into categories', () => {
  const row = (name: string) => page.locator('.category-row', { hasText: name });

  /** Doc + section + CHARACTERS > GURA > HISTORY category tree. */
  async function setup() {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Filing Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('CHARACTERS');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await row('CHARACTERS').locator('.category-row-btn', { hasText: '+' }).click();
    await page.locator('.category-new-form input.input').fill('GURA');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await row('GURA').locator('.category-row-btn', { hasText: '+' }).click();
    await page.locator('.category-new-form input.input').fill('HISTORY');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await expect(row('HISTORY')).toBeVisible();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Gura was born in Atlantis.', { delay: 15 });
    return editor;
  }

  /** Tag the whole line, filing it under the given category label. */
  async function tagAndFile(fileUnder: string | null) {
    await page.keyboard.press('Meta+A');
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    if (fileUnder) {
      // Option labels carry a non-breaking-space indent, so resolve the value instead.
      const value = await modal
        .locator('select.input option', { hasText: fileUnder })
        .first()
        .getAttribute('value');
      await modal.locator('select.input').selectOption(value!);
    }
    await modal.locator('.autocomplete input.input').fill('GURA TAG');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
  }

  test('files an excerpt while tagging, and the category page compiles it', async () => {
    await setup();
    await tagAndFile('HISTORY');

    // Open HISTORY's page from the left sidebar (click the name, not the row).
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.category-name-link', { hasText: 'HISTORY' }).click();

    const info = page.locator('.right-sidebar');
    await expect(info.locator('.category-page')).toBeVisible();
    await expect(info.locator('.placement-row')).toHaveCount(1);
    await expect(info.locator('.placement-excerpt')).toContainText('Gura was born in Atlantis.');
    await expect(info.locator('.placement-source')).toContainText('Filing Test › Main');
  });

  test('a parent page shows excerpts filed in its children as sections', async () => {
    await setup();
    await tagAndFile('HISTORY');

    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.category-name-link', { hasText: 'GURA' }).click();

    const info = page.locator('.right-sidebar');
    await expect(info.locator('.placement-subheading', { hasText: 'HISTORY' })).toBeVisible();
    await expect(info.locator('.placement-row')).toHaveCount(1);

    // Drilling into the HISTORY heading opens HISTORY's own page with a breadcrumb.
    await info.locator('.placement-subheading', { hasText: 'HISTORY' }).click();
    await expect(info.locator('.placement-breadcrumb')).toContainText('CHARACTERS › GURA ›');
  });

  test('File under… on an existing highlight files it after the fact', async () => {
    await setup();
    await tagAndFile(null); // tagged but unfiled

    await page.locator('.annotation-highlight').click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'File under…' }).click();
    const modal = page.locator('.modal', { hasText: 'File under' });
    const historyValue = await modal
      .locator('select.input option', { hasText: 'HISTORY' })
      .first()
      .getAttribute('value');
    await modal.locator('select.input').selectOption(historyValue!);
    await modal.locator('.btn-primary', { hasText: 'Save' }).click();

    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.category-name-link', { hasText: 'HISTORY' }).click();
    await expect(page.locator('.right-sidebar .placement-row')).toHaveCount(1);
  });

  test('the tag page groups excerpts by where they are filed', async () => {
    await setup();
    await tagAndFile('HISTORY');

    // Focus the tag from the left sidebar search list.
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('GURA TAG');
    await page.locator('.tag-tree-item', { hasText: 'GURA TAG' }).first().click();

    const info = page.locator('.right-sidebar');
    await expect(info.locator('.info-section-title', { hasText: 'HISTORY' })).toBeVisible();
    await expect(info.locator('.placement-row')).toHaveCount(1);

    // The group heading is a link into the category's own page.
    await info.locator('.placement-subheading', { hasText: 'HISTORY' }).click();
    await expect(info.locator('.category-page')).toBeVisible();
  });

  test('clicking an excerpt jumps back to the text', async () => {
    await setup();
    await tagAndFile('HISTORY');

    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.category-name-link', { hasText: 'HISTORY' }).click();
    await page.locator('.right-sidebar .placement-row').click();

    // The highlighted text is shown, and the page stays open so you can keep clicking
    // through excerpts — it used to collapse on the first click.
    await expect(page.locator('.annotation-highlight')).toBeVisible();
    await expect(page.locator('.right-sidebar .category-page')).toBeVisible();
  });

  test('an empty category page explains how to file', async () => {
    await setup();
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.category-name-link', { hasText: 'HISTORY' }).click();
    await expect(page.locator('.right-sidebar .empty-state')).toContainText('Nothing filed here yet');
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

// ─── Graph view ──────────────────────────────────────────────────────

test.describe('Graph view', () => {
  test('maps categories, tags and filings, and nodes open their pages', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Graph Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    // One extra category and a tag (General exists already).
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('CHARACTERS');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await page.locator('.btn', { hasText: '+ New Tag' }).click();
    await page.locator('.modal input.input').first().fill('Gura');
    await page.locator('.modal .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.badge', { hasText: 'Gura' })).toBeVisible();

    await page.locator('.toolbar-btn[aria-label="Graph view"]').click();
    const graph = page.locator('.graph-overlay');
    await expect(graph).toBeVisible();

    // 2 categories + 1 tag, and the tag's membership edge.
    await expect(graph.locator('.graph-node-category')).toHaveCount(2);
    await expect(graph.locator('.graph-node-tag')).toHaveCount(1);
    await expect(graph.locator('.graph-canvas .graph-edge-member')).toHaveCount(1);
    await expect(graph).toContainText('CHARACTERS');
    await expect(graph).toContainText('Gura');

    // Clicking the tag node closes the graph and opens the tag's page.
    await graph.locator('.graph-node-tag circle').click({ force: true });
    await expect(graph).toHaveCount(0);
    await expect(page.locator('.right-sidebar')).toContainText('Usage');
  });

  test('same-named categories in the graph show their parent for context', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Graph Names');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();

    const newCat = async (name: string, parent?: string) => {
      if (parent) {
        await page.locator('.category-row', { hasText: parent })
          .locator('.category-row-btn', { hasText: '+' }).first().click();
      } else {
        await page.locator('.btn', { hasText: '+ New Category' }).click();
      }
      await page.locator('.category-new-form input.input').fill(name);
      await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
      await expect(page.locator('.category-row', { hasText: name }).first()).toBeVisible();
    };
    // Two GURA/PEKORA each with a HISTORY — the ambiguous case.
    await newCat('GURA');
    await newCat('PEKORA');
    await newCat('HISTORY', 'GURA');
    await newCat('HISTORY', 'PEKORA');

    await page.locator('.toolbar-btn[aria-label="Graph view"]').click();
    const graph = page.locator('.graph-overlay');
    await expect(graph).toBeVisible();

    // The shared name is prefixed with its parent in the visible label (a <text>);
    // the unique ones are not.
    await expect(graph.locator('text', { hasText: 'GURA › HISTORY' })).toBeVisible();
    await expect(graph.locator('text', { hasText: 'PEKORA › HISTORY' })).toBeVisible();
    const labels = await graph.locator('.graph-node-category text').allTextContents();
    expect(labels).toContain('GURA');
    expect(labels).toContain('PEKORA');
    // Full path is available on hover (SVG <title>).
    await expect(graph.locator('.graph-node-category title', { hasText: 'GURA › HISTORY' }).first()).toBeAttached();
  });

  test('Escape closes it', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Graph Esc');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.toolbar-btn[aria-label="Graph view"]').click();
    await expect(page.locator('.graph-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.graph-overlay')).toHaveCount(0);
  });
});

// ─── Workspaces ──────────────────────────────────────────────────────

test.describe('Workspaces', () => {
  const bar = () => page.locator('.workspace-bar');

  async function newWorkspace(name: string) {
    await page.locator('.workspace-bar__current').click();
    await page.locator('.workspace-bar__item', { hasText: '+ New workspace' }).click();
    await page.locator('.workspace-bar__input').fill(name);
    await page.locator('.workspace-bar .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.workspace-bar__current')).toContainText(name);
  }

  test('starts in a default workspace', async () => {
    await expect(bar()).toBeVisible();
    await expect(page.locator('.workspace-bar__current')).toContainText('My World');
  });

  test('documents and categories are isolated between workspaces', async () => {
    // A document and a category in the default workspace.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('World One Doc');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('WORLD ONE ONLY');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.category-row', { hasText: 'WORLD ONE ONLY' })).toBeVisible();
    await page.locator('.toolbar-back-btn').click();
    await expect(page.locator('.document-card')).toHaveCount(1);

    await newWorkspace('Game 2');

    // The new world is empty — no documents carried over.
    await expect(page.locator('.document-card')).toHaveCount(0);

    // And its category tree is its own.
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('World Two Doc');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await expect(page.locator('.category-row', { hasText: 'WORLD ONE ONLY' })).toHaveCount(0);
  });

  test('the same category name can exist in two workspaces', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Doc A');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('CHARACTERS');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.category-row', { hasText: 'CHARACTERS' })).toBeVisible();
    await page.locator('.toolbar-back-btn').click();

    await newWorkspace('Game 2');
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Doc B');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('CHARACTERS');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();

    // Would have collided when root names were globally unique.
    await expect(page.locator('.category-row', { hasText: 'CHARACTERS' })).toHaveCount(1);
    await expect(page.locator('.category-new-form .rule-error')).toHaveCount(0);
  });

  test('switching back shows the first workspace again', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Original');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.toolbar-back-btn').click();

    await newWorkspace('Game 2');
    await expect(page.locator('.document-card')).toHaveCount(0);

    await page.locator('.workspace-bar__current').click();
    await page.locator('.workspace-bar__item', { hasText: 'My World' }).click();
    await expect(page.locator('.document-card')).toHaveCount(1);
    await expect(page.locator('.document-card-title')).toHaveText('Original');
  });
});
