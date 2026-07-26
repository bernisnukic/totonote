import type { StateCreator } from 'zustand';
import { invoke } from '../lib/ipc-client';

/** How long after you stop typing a History checkpoint is taken, unless changed. */
export const DEFAULT_HISTORY_INTERVAL_MS = 1000;

/** Sensible bounds: below 50ms it fires mid-keystroke, above 10s it stops feeling live. */
export const MIN_HISTORY_INTERVAL_MS = 50;
export const MAX_HISTORY_INTERVAL_MS = 10000;

/** Line height for the editor, unless changed. Matches the editor's original styling. */
export const DEFAULT_LINE_SPACING = 1.7;
const MIN_LINE_SPACING = 1.2;
const MAX_LINE_SPACING = 2.4;

export function clampLineSpacing(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LINE_SPACING;
  return Math.min(MAX_LINE_SPACING, Math.max(MIN_LINE_SPACING, Math.round(value * 100) / 100));
}

export function parseLineSpacing(raw: string | null): number {
  if (raw == null || raw === '') return DEFAULT_LINE_SPACING;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? clampLineSpacing(parsed) : DEFAULT_LINE_SPACING;
}

export function clampHistoryInterval(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_HISTORY_INTERVAL_MS;
  return Math.min(MAX_HISTORY_INTERVAL_MS, Math.max(MIN_HISTORY_INTERVAL_MS, Math.round(ms)));
}

/** Read the stored value, falling back to the default for anything unusable. */
export function parseHistoryInterval(raw: string | null): number {
  if (raw == null || raw === '') return DEFAULT_HISTORY_INTERVAL_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? clampHistoryInterval(parsed) : DEFAULT_HISTORY_INTERVAL_MS;
}

export interface PreferenceSlice {
  shortcuts: Record<string, string>;
  theme: string;
  /** When true (default) the editor debounce-saves as you type; when false the user saves
   *  manually with Cmd+S and is warned about unsaved work on exit. */
  autoSaveEnabled: boolean;
  /** How long after you stop typing a History checkpoint is taken, in milliseconds. */
  historyIntervalMs: number;
  /** Play the opening animation on launch. Off starts straight into the app. */
  introEnabled: boolean;
  /** Gap between lines of writing, as a CSS line-height multiplier. */
  lineSpacing: number;

  loadPreferences: () => Promise<void>;
  updateShortcut: (action: string, keybinding: string) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
  setAutoSaveEnabled: (enabled: boolean) => Promise<void>;
  setHistoryIntervalMs: (ms: number) => Promise<void>;
  setIntroEnabled: (enabled: boolean) => Promise<void>;
  setLineSpacing: (value: number) => Promise<void>;
  /** Read/write an arbitrary persisted flag (stored in the SQLite preferences table,
   *  so it travels with the user's database rather than resetting on a re-download). */
  readPreference: (key: string) => Promise<string | null>;
  writePreference: (key: string, value: string) => Promise<void>;
}

export const createPreferenceSlice: StateCreator<PreferenceSlice, [], [], PreferenceSlice> = (set) => ({
  shortcuts: {},
  theme: 'dark',
  autoSaveEnabled: true,
  historyIntervalMs: DEFAULT_HISTORY_INTERVAL_MS,
  introEnabled: true,
  lineSpacing: DEFAULT_LINE_SPACING,

  loadPreferences: async () => {
    const [shortcutsRaw, themeRaw, autoSaveRaw, historyRaw, introRaw, spacingRaw] = await Promise.all([
      invoke('preference:get', { key: 'shortcuts' }),
      invoke('preference:get', { key: 'theme' }),
      invoke('preference:get', { key: 'autoSave' }),
      invoke('preference:get', { key: 'historyInterval' }),
      invoke('preference:get', { key: 'introEnabled' }),
      invoke('preference:get', { key: 'lineSpacing' }),
    ]);
    set({
      shortcuts: shortcutsRaw ? JSON.parse(shortcutsRaw) : {},
      theme: themeRaw || 'dark',
      // Default on — only an explicit 'false' turns it off.
      autoSaveEnabled: autoSaveRaw !== 'false',
      historyIntervalMs: parseHistoryInterval(historyRaw),
      // Default on — only an explicit 'false' skips it.
      introEnabled: introRaw !== 'false',
      lineSpacing: parseLineSpacing(spacingRaw),
    });
  },

  setHistoryIntervalMs: async (ms) => {
    const clamped = clampHistoryInterval(ms);
    await invoke('preference:set', { key: 'historyInterval', value: String(clamped) });
    set({ historyIntervalMs: clamped });
  },

  setLineSpacing: async (value) => {
    const clamped = clampLineSpacing(value);
    await invoke('preference:set', { key: 'lineSpacing', value: String(clamped) });
    set({ lineSpacing: clamped });
  },

  setIntroEnabled: async (enabled) => {
    await invoke('preference:set', { key: 'introEnabled', value: enabled ? 'true' : 'false' });
    set({ introEnabled: enabled });
  },

  setAutoSaveEnabled: async (enabled) => {
    await invoke('preference:set', { key: 'autoSave', value: enabled ? 'true' : 'false' });
    set({ autoSaveEnabled: enabled });
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

  readPreference: (key) => invoke('preference:get', { key }),
  writePreference: (key, value) => invoke('preference:set', { key, value }),
});
