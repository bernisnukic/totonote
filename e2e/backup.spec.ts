import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { registerAppHooks } from './fixtures';

/**
 * Backing the world up and putting it back.
 *
 * The file dialogs are native, so they are stubbed in the main process — everything else is
 * the real path: the real online backup, the real validation, the real file swap.
 */
let app: ElectronApplication;
let page: Page;
let dbPath: string;
let scratch: string;

registerAppHooks(handles => {
  app = handles.app;
  page = handles.page;
  dbPath = handles.dbPath;
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'totonote-backup-e2e-'));
});

test.afterEach(() => {
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
});

/** Point the next Save dialog at `target` instead of asking. */
async function stubSaveDialog(target: string) {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);
}

/**
 * Point the next Open dialog at `source`, agree to the warning, and neuter the relaunch —
 * a real restart would take the test's window with it.
 */
async function stubRestoreDialogs(source: string) {
  await app.evaluate(({ dialog, app: electronApp }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    electronApp.relaunch = () => undefined;
    electronApp.exit = () => undefined;
  }, source);
}

async function openBackupSettings() {
  // The gear is the last button in the last toolbar group.
  await page.locator('.toolbar-group').last().locator('.toolbar-btn').last().click();
  await expect(page.locator('.modal-title')).toHaveText('Settings');
  await expect(page.locator('.settings-section-title', { hasText: 'Backup' })).toBeVisible();
}

async function createDocument(title: string) {
  await page.locator('.document-card-new').click();
  await page.locator('.modal input.input').first().fill(title);
  await page.locator('.modal .btn-primary').click();
  await expect(page.locator('.main-toolbar')).toContainText(title);
}

test.describe('Whole-world backup', () => {
  test('saves a backup file holding everything', async () => {
    await createDocument('Hololore');
    const target = path.join(scratch, 'world.totonote');
    await stubSaveDialog(target);

    await openBackupSettings();
    await page.locator('.btn', { hasText: 'Back up everything' }).click();

    // The panel reports what went in, and the file really is a database.
    await expect(page.locator('.settings-toggle-hint', { hasText: 'Saved 1 document' })).toBeVisible();
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target).subarray(0, 15).toString()).toBe('SQLite format 3');
  });

  test('restoring puts the backed-up world back and keeps the replaced one aside', async () => {
    await createDocument('The world as it was');
    const target = path.join(scratch, 'world.totonote');
    await stubSaveDialog(target);

    await openBackupSettings();
    await page.locator('.btn', { hasText: 'Back up everything' }).click();
    await expect(page.locator('.settings-toggle-hint', { hasText: 'Saved 1 document' })).toBeVisible();

    await stubRestoreDialogs(target);
    await page.locator('.btn', { hasText: 'Restore from a backup' }).click();

    // The database on disk is now the backup, byte for byte, and the world it replaced is
    // still there to rename back if the wrong file was picked.
    await expect
      .poll(() => fs.existsSync(`${dbPath}.replaced`), { timeout: 10000 })
      .toBe(true);
    expect(fs.readFileSync(dbPath).equals(fs.readFileSync(target))).toBe(true);
  });

  test('refuses a file that is not a backup, without touching anything', async () => {
    await createDocument('Keep me');
    const notABackup = path.join(scratch, 'holiday.jpg');
    fs.writeFileSync(notABackup, 'a photo, not a world');
    const before = fs.readFileSync(dbPath);

    await stubRestoreDialogs(notABackup);
    await openBackupSettings();
    await page.locator('.btn', { hasText: 'Restore from a backup' }).click();

    await expect(
      page.locator('.settings-toggle-hint', { hasText: 'not a TotoNote backup' }),
    ).toBeVisible();
    expect(fs.readFileSync(dbPath).equals(before)).toBe(true);
  });
});
