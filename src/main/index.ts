import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import path from 'path';
import { initDb, closeDb } from './db/connection';
import { registerIpcHandlers } from './ipc/handlers';
import { buildAppMenu } from './menu';
import { getMediaBytes } from './db/repositories/media-repo';
import { MEDIA_SCHEME, MEDIA_HOST } from '../shared/media-refs';
import { queueOcrBacklog } from './services/ocr-queue';
import { shutdownOcr } from './services/ocr';

// Set before anything reads it. Without this the app identifies itself as "Electron":
// the macOS menu bar shows "Electron" beside the Apple logo, and app.getPath('userData')
// lands in ~/Library/Application Support/Electron. Must run before app 'ready'.
app.setName('TotoNote');

// Embedded images are served from the database over totonote://media/<id>. The scheme has
// to be declared privileged *before* the app is ready, or <img> requests to it are treated
// as an unknown protocol and blocked. `standard` gives it normal URL parsing (host + path).
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

// In manual-save mode the renderer reports whether there's unsaved work, so we can warn
// before the window closes. Stays false whenever auto-save is on (nothing to lose).
let unsavedChanges = false;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Log renderer console messages to main process stdout
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  // DevTools only in dev. app.isPackaged is the canonical check —
  // NODE_ENV is unset in packaged builds, so the old `!== 'test'` guard
  // opened DevTools in production too (the mystery "second window").
  if (!app.isPackaged && process.env.NODE_ENV !== 'test') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Warn before closing with unsaved work (manual-save mode only). Under automation we
  // never prompt, so tests can close the window freely.
  mainWindow.on('close', e => {
    if (!unsavedChanges || process.env.NODE_ENV === 'test' || !mainWindow) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'You have unsaved changes.',
      detail: 'Do you want to save them before quitting?',
    });
    if (choice === 2) {
      e.preventDefault(); // Cancel — stay open.
    } else if (choice === 1) {
      unsavedChanges = false; // Don't Save — let the close proceed.
    } else {
      e.preventDefault(); // Save — flush in the renderer, then it force-quits.
      mainWindow.webContents.send('app:save-and-quit');
    }
  });
};

app.whenReady().then(() => {
  // Initialize database
  initDb();

  // Serve embedded images out of the database. The renderer has no filesystem access and
  // the bytes are not in the document, so this is how an <img> gets its pixels.
  protocol.handle(MEDIA_SCHEME, request => {
    const url = new URL(request.url);
    if (url.hostname !== MEDIA_HOST) {
      return new Response('Not found', { status: 404 });
    }
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const found = id ? getMediaBytes(id) : null;
    if (!found) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(new Uint8Array(found.data), {
      status: 200,
      headers: {
        'Content-Type': found.mimeType,
        // Ids are content-addressed by creation, so a given id never changes bytes.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  });

  // Register IPC handlers
  registerIpcHandlers();

  // Unsaved-changes tracking for the close warning.
  ipcMain.handle('window:set-dirty', (_e, args: { dirty: boolean }) => {
    unsavedChanges = Boolean(args?.dirty);
  });
  // After the renderer has flushed pending saves, it asks to quit for real.
  ipcMain.handle('app:force-quit', () => {
    unsavedChanges = false;
    app.quit();
  });

  // Application menu — also what puts the real app name in the macOS menu bar and
  // gives the editor its Cmd+C/V/Z roles.
  buildAppMenu();

  // Read any pictures imported before this feature existed, a bounded batch per launch.
  queueOcrBacklog();

  // Create main window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void shutdownOcr();
  closeDb();
});

// Vite HMR declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
