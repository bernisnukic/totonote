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
export function registerAppHooks(onReady: (handles: { app: ElectronApplication; page: Page }) => void): void {
  let testDbPath: string;
  let app: ElectronApplication;

  test.beforeAll(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'totonote-e2e-'));
    testDbPath = path.join(tmpDir, 'test.db');
  });

  test.beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    app = await electron.launch({
      args: [path.join(ROOT, '.vite/build/index.js')],
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
    onReady({ app, page });
  });

  test.afterEach(async () => {
    if (app) await app.close();
  });

  test.afterAll(() => {
    if (testDbPath && fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });
}
