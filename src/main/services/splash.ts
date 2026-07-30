import { app, BrowserWindow } from 'electron';
import { MINIMUM_MS, MAXIMUM_MS } from './splash-timing';
import fs from 'fs';
import path from 'path';

/**
 * The splash window.
 *
 * A real one: its own small frameless window, on screen *instead of* the app while the
 * app loads — not an overlay drawn on top of a main window that is already visible. The
 * main window stays hidden (`show: false`) until this closes, so the first thing anyone
 * sees is the splash and the second is a fully-drawn app.
 *
 * It has no preload and no access to the database or IPC. A splash that can fail is worse
 * than no splash, so the only thing it is given is a version string on the query.
 */

let splash: BrowserWindow | null = null;

/** Dev keeps it in the repo; the packaged app gets it via Forge's extraResource. */
function findSplashFile(): string | null {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'splash', 'splash.html'),
    path.join(__dirname, 'splash', 'splash.html'),
    process.resourcesPath ? path.join(process.resourcesPath, 'splash', 'splash.html') : '',
  ].filter(Boolean);
  return candidates.find(f => fs.existsSync(f)) ?? null;
}

export function createSplashWindow(): BrowserWindow | null {
  const file = findSplashFile();
  if (!file) return null;

  splash = new BrowserWindow({
    width: 420,
    height: 260,
    // No frame, no title bar, not resizable — everything that makes it a window rather
    // than a splash is switched off.
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    // Painted before it is shown, so it never flashes an empty rectangle.
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  splash.loadFile(file, { search: `v=${encodeURIComponent(app.getVersion())}` });
  splash.once('ready-to-show', () => splash?.show());
  splash.on('closed', () => {
    splash = null;
  });
  return splash;
}

export function closeSplash(): void {
  if (splash && !splash.isDestroyed()) splash.close();
  splash = null;
}

/**
 * Run the splash for `main`, then hand over.
 *
 * Resolves once the main window has been shown. The splash stays up for at least one
 * play-through of the animation *and* until the renderer is ready to paint, whichever is
 * later — so a fast machine still sees the mark, and a slow one never sees a half-drawn
 * window. Clicking the splash skips the wait.
 */
export function runSplash(main: BrowserWindow): Promise<void> {
  const window = createSplashWindow();
  if (!window) {
    main.show();
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    let done = false;
    const handOver = () => {
      if (done) return;
      done = true;
      closeSplash();
      if (!main.isDestroyed()) {
        main.show();
        main.focus();
      }
      resolve();
    };

    let elapsed = false;
    let ready = false;
    const advance = () => {
      if (elapsed && ready) handOver();
    };

    setTimeout(() => {
      elapsed = true;
      advance();
    }, MINIMUM_MS);

    if (main.webContents.isLoading()) {
      main.once('ready-to-show', () => {
        ready = true;
        advance();
      });
    } else {
      ready = true;
    }

    // Impatience, and the backstop.
    window.webContents.on('before-input-event', handOver);
    window.on('closed', handOver);
    setTimeout(handOver, MAXIMUM_MS);
  });
}
