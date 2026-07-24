import { contextBridge, ipcRenderer } from 'electron';
import { isIpcChannel } from '../shared/ipc-types';

/** Channels the main process may push to the renderer, and nothing else. */
const MENU_CHANNELS = [
  'menu:open-help',
  'menu:new-document',
  'menu:reset-layout',
  'menu:undo',
  'menu:redo',
  'menu:save-all',
  'app:save-and-quit',
] as const;

const api = {
  /**
   * Call a main-process handler. The channel has to be one the app actually declares —
   * this bridge is the renderer's only route into main, so it should expose exactly the
   * documented surface and nothing more, the same way onMenu does.
   */
  invoke: (channel: string, args?: unknown) => {
    if (!isIpcChannel(channel)) {
      throw new Error(`Unsupported IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, args);
  },
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
