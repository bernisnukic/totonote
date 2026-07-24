import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { initDb, closeDb } from './db/connection';
import { registerIpcHandlers } from './ipc/handlers';
import { buildAppMenu } from './menu';

// Set before anything reads it. Without this the app identifies itself as "Electron":
// the macOS menu bar shows "Electron" beside the Apple logo, and app.getPath('userData')
// lands in ~/Library/Application Support/Electron. Must run before app 'ready'.
app.setName('TotoNote');

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
  closeDb();
});

// Vite HMR declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
