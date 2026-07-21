import { contextBridge, ipcRenderer } from 'electron';

/** Channels the main process may push to the renderer, and nothing else. */
const MENU_CHANNELS = ['menu:open-help', 'menu:new-document'] as const;

const api = {
  invoke: (channel: string, args?: unknown) => ipcRenderer.invoke(channel, args),
  /** Subscribe to a menu command. Returns an unsubscribe function. */
  onMenu: (channel: string, listener: (payload?: unknown) => void) => {
    if (!(MENU_CHANNELS as readonly string[]).includes(channel)) {
      throw new Error(`Unsupported menu channel: ${channel}`);
    }
    const handler = (_event: unknown, payload?: unknown) => listener(payload);
    ipcRenderer.on(channel, handler as never);
    return () => ipcRenderer.removeListener(channel, handler as never);
  },
};

contextBridge.exposeInMainWorld('api', api);

// Type declaration for the renderer
export type ElectronApi = typeof api;
