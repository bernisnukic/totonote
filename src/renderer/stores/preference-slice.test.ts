// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createPreferenceSlice, type PreferenceSlice } from './preference-slice';

/**
 * Preferences live in the SQLite `preferences` table rather than localStorage, so they
 * survive a re-download. These tests pin the read/write shape and — importantly — the
 * defaults applied when a key has never been written.
 */

type Stored = Record<string, string | null>;

function mockApi(stored: Stored) {
  const writes: Array<{ key: string; value: string }> = [];
  (window as unknown as { api: { invoke: (c: string, a?: unknown) => Promise<unknown> } }).api = {
    invoke: (channel, args) => {
      if (channel === 'preference:get') {
        const { key } = args as { key: string };
        return Promise.resolve(stored[key] ?? null);
      }
      if (channel === 'preference:set') {
        const w = args as { key: string; value: string };
        writes.push(w);
        stored[w.key] = w.value;
      }
      return Promise.resolve(undefined);
    },
  };
  return writes;
}

let store: StoreApi<PreferenceSlice>;
beforeEach(() => {
  store = createStore<PreferenceSlice>((...a) => createPreferenceSlice(...a));
});

describe('preference slice', () => {
  it('defaults to dark theme and auto-save ON for a fresh database', async () => {
    mockApi({});
    await store.getState().loadPreferences();
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().autoSaveEnabled).toBe(true);
    expect(store.getState().shortcuts).toEqual({});
  });

  it('only the literal string "false" turns auto-save off', async () => {
    // Anything else — missing, empty, garbage — must leave saving switched on, because
    // silently not saving is the worst possible failure for a notes app.
    for (const [value, expected] of [
      ['false', false],
      ['true', true],
      ['', true],
      ['0', true],
    ] as const) {
      const s = createStore<PreferenceSlice>((...a) => createPreferenceSlice(...a));
      mockApi({ autoSave: value });
      await s.getState().loadPreferences();
      expect(s.getState().autoSaveEnabled, `autoSave=${JSON.stringify(value)}`).toBe(expected);
    }
  });

  it('reads back a stored theme and shortcuts', async () => {
    mockApi({ theme: 'wood', shortcuts: JSON.stringify({ bold: 'Cmd+B' }) });
    await store.getState().loadPreferences();
    expect(store.getState().theme).toBe('wood');
    expect(store.getState().shortcuts).toEqual({ bold: 'Cmd+B' });
  });

  it('persists the auto-save choice as a string', async () => {
    const writes = mockApi({});
    await store.getState().setAutoSaveEnabled(false);
    expect(writes).toContainEqual({ key: 'autoSave', value: 'false' });
    expect(store.getState().autoSaveEnabled).toBe(false);
  });

  it('persists a theme change', async () => {
    const writes = mockApi({});
    await store.getState().setTheme('black');
    expect(writes).toContainEqual({ key: 'theme', value: 'black' });
    expect(store.getState().theme).toBe('black');
  });

  it('updating one shortcut keeps the others', async () => {
    mockApi({ shortcuts: JSON.stringify({ bold: 'Cmd+B' }) });
    await store.getState().loadPreferences();
    await store.getState().updateShortcut('italic', 'Cmd+I');
    expect(store.getState().shortcuts).toEqual({ bold: 'Cmd+B', italic: 'Cmd+I' });
  });
});
