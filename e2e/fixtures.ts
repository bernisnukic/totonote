import { test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const ROOT = path.resolve(__dirname, '..');

/**
 * Launches the built app against a throwaway database, once per test.
 *
 * Each spec file keeps its own `app` / `page` bindings and hands in a setter, so test
 * bodies go on using them directly. Every test starts from an empty database — the file
 * is deleted between runs — so nothing leaks from one test to the next.
 */
export function registerAppHooks(
  onReady: (handles: { app: ElectronApplication; page: Page; dbPath: string }) => void,
): void {
  let testDbPath: string;
  let app: ElectronApplication;

  test.beforeAll(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'totonote-e2e-'));
    testDbPath = path.join(tmpDir, 'test.db');
  });

  test.beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    app = await electron.launch({
      args: [
        // CI runners restrict unprivileged user namespaces, which Electron's sandbox needs;
        // without this the app never starts there. Local runs keep the sandbox on.
        ...(process.env.CI ? ['--no-sandbox'] : []),
        path.join(ROOT, '.vite/build/index.js'),
      ],
      env: {
        ...process.env,
        TOTONOTE_DB_PATH: testDbPath,
        NODE_ENV: 'test',
      },
    });

    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    // Wait for React to mount.
    await page.waitForSelector('.app-container', { timeout: 10000 });
    onReady({ app, page, dbPath: testDbPath });
  });

  test.afterEach(async () => {
    if (app) await app.close();
  });

  test.afterAll(() => {
    if (testDbPath && fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });
}

/**
 * Confirm the app's own dialog, which replaced `window.confirm`.
 *
 * Unlike the native one there is nothing to arm in advance: trigger the action first, then
 * call this. Returns everything the dialog said — headline *and* detail — so a test can
 * assert on any part of what the user was actually told.
 */
export async function acceptConfirm(page: Page): Promise<string> {
  const modal = page.locator('.modal', { has: page.locator('.confirm-message') });
  await modal.waitFor({ state: 'visible' });
  const message = (await modal.locator('.modal-body').textContent()) ?? '';
  await modal.locator('.modal-footer .btn-primary, .modal-footer .btn-danger').click();
  await modal.waitFor({ state: 'detached' });
  return message;
}

/**
 * Confirm the dialog if one appeared, and carry on if it did not.
 *
 * For actions that only sometimes ask — restoring a checkpoint prompts only when there are
 * later highlights to discard.
 */
export async function dismissConfirmIfShown(page: Page): Promise<boolean> {
  const modal = page.locator('.modal', { has: page.locator('.confirm-message') });
  if (!(await modal.isVisible())) return false;
  await acceptConfirm(page);
  return true;
}

/** Decline the app's confirm dialog, waiting for it rather than racing it. */
export async function declineConfirm(page: Page): Promise<void> {
  const modal = page.locator('.modal', { has: page.locator('.confirm-message') });
  await modal.waitFor({ state: 'visible' });
  await modal.locator('.modal-footer .btn-secondary').click();
  await modal.waitFor({ state: 'detached' });
}
