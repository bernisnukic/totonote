import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { registerAppHooks, acceptConfirm } from './fixtures';

// Undo and the in-app guide

let app: ElectronApplication;
let page: Page;
registerAppHooks(h => {
  app = h.app;
  page = h.page;
});

// ─── Undo ────────────────────────────────────────────────────────────

test.describe('Undo', () => {
  test('putting back a deleted tag restores its highlights', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Undo Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.tab-add').click();
    await page.locator('.modal input.input').first().fill('Main');
    await page.locator('.modal .btn-primary').click();

    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('The dragon sleeps', { delay: 15 });
    await page.keyboard.press('ControlOrMeta+A');
    await page.locator('.selection-toolbar-btn', { hasText: 'Tag' }).click();
    const modal = page.locator('.modal');
    await modal.locator('.autocomplete input.input').fill('Dragon');
    await modal.locator('.autocomplete-item-create').click();
    await modal.locator('.btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });

    // Delete the tag from the sidebar.
    await page.locator('.sidebar-mode-btn', { hasText: 'Search' }).click();
    await page.locator('.sidebar-search-input').fill('Dragon');
    await page.locator('.tag-tree-item', { hasText: 'Dragon' }).first().click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Delete' }).click();
    await acceptConfirm(page);
    await expect(page.locator('.annotation-highlight')).toHaveCount(0);

    // The toast offers it back.
    const toast = page.locator('.undo-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Dragon');
    await toast.locator('.undo-toast__btn').click();

    await expect(page.locator('.annotation-highlight')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.undo-toast')).toHaveCount(0);
  });

  test('restores a deleted category and everything under it', async () => {
    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Undo Cat');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.sidebar-tab', { hasText: 'Edit' }).click();
    await page.locator('.btn', { hasText: '+ New Category' }).click();
    await page.locator('.category-new-form input.input').fill('CHARACTERS');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await page.locator('.category-row', { hasText: 'CHARACTERS' })
      .locator('.category-row-btn', { hasText: '+' }).click();
    await page.locator('.category-new-form input.input').fill('GURA');
    await page.locator('.category-new-form .btn-primary', { hasText: 'Create' }).click();
    await expect(page.locator('.category-row', { hasText: 'GURA' })).toBeVisible();

    await page.locator('.category-row', { hasText: 'CHARACTERS' })
      .locator('.category-row-btn', { hasText: '×' }).click();
    await acceptConfirm(page);
    await expect(page.locator('.category-row', { hasText: 'GURA' })).toHaveCount(0);

    await page.locator('.undo-toast__btn').click();
    await expect(page.locator('.category-row', { hasText: 'CHARACTERS' })).toBeVisible();
    await expect(page.locator('.category-row', { hasText: 'GURA' })).toBeVisible();
  });
});

// ─── Help ────────────────────────────────────────────────────────────

test.describe('Help', () => {
  test('the guide opens in the app and links between pages', async () => {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('menu:open-help', 'README'),
    );
    const help = page.locator('.help-overlay');
    await expect(help).toBeVisible();
    await expect(help.locator('.help-nav-item')).not.toHaveCount(0);

    await help.locator('.help-nav-item', { hasText: "What's New" }).click();
    await expect(help.locator('.help-content h1')).toContainText("What's New");

    await page.keyboard.press('Escape');
    await expect(page.locator('.help-overlay')).toHaveCount(0);
  });

  test('overlays clear the macOS traffic lights in windowed mode', async () => {
    // Reported: the "HELP" label sat underneath the window buttons unless the app was
    // fullscreen. Both overlays now start below the reserved title-bar strip.
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.setFullScreen(false);
      w.setSize(1100, 760);
    });
    await page.waitForTimeout(400);

    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('menu:open-help', 'README'),
    );
    await expect(page.locator('.help-overlay')).toBeVisible();
    const helpTitle = await page.locator('.help-title').boundingBox();
    expect(helpTitle!.y).toBeGreaterThanOrEqual(38);
    await page.keyboard.press('Escape');

    await page.locator('.document-card-new').click();
    await page.locator('.modal input.input').first().fill('Overlay Test');
    await page.locator('.modal .btn-primary').click();
    await page.locator('.toolbar-btn[aria-label="Graph view"]').click();
    await expect(page.locator('.graph-overlay')).toBeVisible();
    const graphTitle = await page.locator('.graph-title').boundingBox();
    expect(graphTitle!.y).toBeGreaterThanOrEqual(38);
  });

  test('lists guide pages in reading order', async () => {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('menu:open-help', 'README'),
    );
    const items = await page.locator('.help-nav-item').allTextContents();
    expect(items[0]).toBe('Overview');
    expect(items[1]).toBe('Getting started');
    expect(items[2]).toBe('Glossary');
    expect(items[3]).toBe('Workspaces');
    expect(items[items.length - 1]).toBe("What's New");
    // Titles come from each page's own heading, not from CSS mangling the filename.
    expect(items).toContain('Documents and sections');
    // Every guide page must be reachable from here, or it may as well not exist.
    expect(items).toContain('Links and the timeline');
    expect(items).toContain('Backup and restore');
  });

  test('records the app version in the database, and reaches the changelog', async () => {
    // The auto-open on update is decided by decideFirstRun (unit-tested) and suppressed
    // under automation. Here we check the two moving parts it depends on: the version is
    // recorded in the database (survives a re-download, unlike localStorage), and the
    // changelog page renders when opened.
    await page.waitForTimeout(400);
    const version = await page.evaluate(() => window.api.invoke('app:version'));
    const lastSeen = await page.evaluate(() =>
      window.api.invoke('preference:get', { key: 'last-seen-version' }),
    );
    expect(lastSeen).toBe(version);

    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('menu:open-help', 'CHANGELOG'),
    );
    await expect(page.locator('.help-overlay')).toBeVisible();
    await expect(page.locator('.help-content h1')).toContainText("What's New");
    await page.keyboard.press('Escape');
  });

  test('has a real application menu, not the Electron default', async () => {
    const labels = await app.evaluate(({ Menu }) =>
      (Menu.getApplicationMenu()?.items ?? []).map(i => i.label),
    );
    expect(labels).toContain('Edit');
    expect(labels).toContain('Help');
    expect(labels).not.toContain('Electron');
    expect(await app.evaluate(({ app: a }) => a.getName())).toBe('TotoNote');
  });
});
