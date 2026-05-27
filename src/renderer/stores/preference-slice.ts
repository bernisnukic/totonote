import type { StateCreator } from 'zustand';
import { invoke } from '../lib/ipc-client';

export interface PreferenceSlice {
  shortcuts: Record<string, string>;
  theme: string;

  loadPreferences: () => Promise<void>;
  updateShortcut: (action: string, keybinding: string) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
}

export const createPreferenceSlice: StateCreator<PreferenceSlice, [], [], PreferenceSlice> = (set) => ({
  shortcuts: {},
  theme: 'dark',

  loadPreferences: async () => {
    const [shortcutsRaw, themeRaw] = await Promise.all([
      invoke('preference:get', { key: 'shortcuts' }),
      invoke('preference:get', { key: 'theme' }),
    ]);
    set({
      shortcuts: shortcutsRaw ? JSON.parse(shortcutsRaw) : {},
      theme: themeRaw || 'dark',
    });
  },

  updateShortcut: async (action, keybinding) => {
    set(s => {
      const shortcuts = { ...s.shortcuts, [action]: keybinding };
      invoke('preference:set', { key: 'shortcuts', value: JSON.stringify(shortcuts) });
      return { shortcuts };
    });
  },

  setTheme: async (theme) => {
    await invoke('preference:set', { key: 'theme', value: theme });
    set({ theme });
  },
});
