import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * The splash window and the What's New popup.
 *
 * This spec launches its own app instances rather than using the shared fixture, because
 * what it is testing is what happens *before* the main window appears — and the fixture
 * deliberately sets NODE_ENV=test, which switches the splash off so it never sits in front
 * of the rest of the suite.
 */
const ROOT = path.resolve(__dirname, '..');

async function launch(opts: { test?: boolean; dbPath?: string } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'totonote-startup-'));
  const dbPath = opts.dbPath ?? path.join(dir, 'test.db');
  const app = await electron.launch({
    args: [...(process.env.CI ? ['--no-sandbox'] : []), path.join(ROOT, '.vite/build/index.js')],
    env: {
      ...process.env,
      TOTONOTE_DB_PATH: dbPath,
      ...(opts.test === false ? {} : { NODE_ENV: 'test' }),
    },
  });
  return { app, dbPath, dir };
}

/**
 * Every window currently on screen. The splash has no DOM the test driver can reach — it
 * is a separate window with no preload — so it is observed from the main process instead.
 */
async function visibleWindows(app: ElectronApplication) {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter(w => w.isVisible())
      .map(w => ({ resizable: w.isResizable(), bounds: w.getBounds() })),
  );
}

test.describe('The splash window', () => {
  test('appears on its own, small and frameless, while the app window stays hidden', async () => {
    const { app } = await launch({ test: false });
    try {
      // The splash is created hidden and shown on ready-to-show, so wait for it rather
      // than sampling once and racing it.
      await expect.poll(() => visibleWindows(app).then(w => w.length), { timeout: 10000 }).toBe(1);

      const [only] = await visibleWindows(app);
      // The one thing on screen is the splash, not the 1400x900 app window.
      expect(only.resizable).toBe(false);
      expect(only.bounds.width).toBeLessThanOrEqual(500);
      expect(only.bounds.height).toBeLessThanOrEqual(320);
    } finally {
      await app.close();
    }
  });

  test('hands over to the app window, then closes itself', async () => {
    const { app } = await launch({ test: false });
    try {
      await expect
        .poll(
          async () =>
            app.evaluate(({ BrowserWindow }) =>
              BrowserWindow.getAllWindows().filter(w => w.isVisible() && w.isResizable()).length,
            ),
          { timeout: 20000 },
        )
        .toBe(1);

      // And the splash is gone — not merely behind the app.
      const remaining = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().filter(w => w.isVisible() && !w.isResizable()).length,
      );
      expect(remaining).toBe(0);
    } finally {
      await app.close();
    }
  });

  test('is skipped entirely when switched off in Settings', async () => {
    // First run: create the database and record the preference.
    const first = await launch();
    const page = await first.app.firstWindow();
    await page.waitForSelector('.app-container');
    await page.evaluate(() =>
      window.api.invoke('preference:set', { key: 'introEnabled', value: 'false' }),
    );
    await first.app.close();

    const { app } = await launch({ test: false, dbPath: first.dbPath });
    try {
      // The app window is the only one, straight away.
      await expect
        .poll(
          async () =>
            app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.isVisible()).length),
          { timeout: 15000 },
        )
        .toBe(1);
      const resizable = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().filter(w => w.isVisible()).every(w => w.isResizable()),
      );
      expect(resizable).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('never appears under automation, so it cannot block a test run', async () => {
    const { app } = await launch();
    try {
      const page = await app.firstWindow();
      await page.waitForSelector('.app-container');
      const windows = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
      expect(windows).toBe(1);
    } finally {
      await app.close();
    }
  });
});

test.describe("What's New", () => {
  test('opens once for a new version, then stays shut', async () => {
    const { app, dbPath } = await launch();
    const page = await app.firstWindow();
    await page.waitForSelector('.app-container');
    await page.evaluate(() =>
      window.api.invoke('preference:set', { key: 'last-seen-version', value: '0.0.1' }),
    );
    // The popup is suppressed under automation; put navigator.webdriver back the way a
    // real launch has it, then reload.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    });
    await page.reload();
    await page.waitForSelector('.app-container');

    await expect(page.locator('.help-overlay')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.help-nav-item.active')).toHaveText("What's New");
    await page.keyboard.press('Escape');

    // The version is recorded now, so a second launch stays quiet.
    await page.reload();
    await page.waitForSelector('.app-container');
    await page.waitForTimeout(1200);
    await expect(page.locator('.help-overlay')).toHaveCount(0);
    await app.close();
    expect(fs.existsSync(dbPath)).toBe(true);
  });
});
