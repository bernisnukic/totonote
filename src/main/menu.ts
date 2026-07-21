import { app, Menu, shell, BrowserWindow, type MenuItemConstructorOptions } from 'electron';

/**
 * The application menu.
 *
 * Without one, Electron installs a default menu whose app entry is literally named
 * "Electron" and whose Help menu is empty — which is exactly where a user went looking
 * for the guide and found a search box that matched nothing.
 *
 * Help items don't open a browser: they send the renderer a message to open the
 * bundled guide, so it works offline and always matches the installed version.
 */

const ISSUES_URL = 'https://github.com/bernisnukic/totonote/issues';

/** Ask the focused window (or the first one) to open a help page. */
function openHelp(page: string): void {
  const target = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  target?.webContents.send('menu:open-help', page);
}

export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const target = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
            target?.webContents.send('menu:new-document');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      // Without an Edit menu, macOS gives no Cmd+C/V/Z inside the editor at all.
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? ([{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] as MenuItemConstructorOptions[])
          : ([{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([{ type: 'separator' }, { role: 'front' }] as MenuItemConstructorOptions[])
          : ([{ role: 'close' }] as MenuItemConstructorOptions[])),
      ],
    },
    {
      role: 'help',
      submenu: [
        { label: 'User Guide', accelerator: isMac ? 'Cmd+?' : 'F1', click: () => openHelp('README') },
        { label: 'Getting Started', click: () => openHelp('getting-started') },
        { label: 'Categories and Rules', click: () => openHelp('categories-and-rules') },
        { label: 'Filing and the Graph', click: () => openHelp('filing-and-graph') },
        { label: 'Keyboard Shortcuts', click: () => openHelp('keyboard-shortcuts') },
        { type: 'separator' },
        { label: "What's New", click: () => openHelp('CHANGELOG') },
        { type: 'separator' },
        { label: 'Report an Issue', click: () => shell.openExternal(ISSUES_URL) },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
