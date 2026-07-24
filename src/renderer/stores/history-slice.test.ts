import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createHistorySlice, MAX_SNAPSHOTS, type HistorySlice } from './history-slice';

const content = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

let store: StoreApi<HistorySlice>;
beforeEach(() => {
  store = createStore<HistorySlice>((...a) => createHistorySlice(...a));
});

const hist = (id: string) => store.getState().historyBySection[id] ?? [];

describe('history slice', () => {
  it('records a snapshot and points current at it', () => {
    store.getState().pushSnapshot('s1', content('one'));
    expect(hist('s1')).toHaveLength(1);
    expect(store.getState().currentSnapshotId['s1']).toBe(hist('s1')[0].id);
    expect(hist('s1')[0].preview).toBe('one');
  });

  it('deduplicates an unchanged push', () => {
    store.getState().pushSnapshot('s1', content('same'));
    store.getState().pushSnapshot('s1', content('same'));
    expect(hist('s1')).toHaveLength(1);
  });

  it('appends distinct states oldest-first and advances current', () => {
    store.getState().pushSnapshot('s1', content('a'));
    store.getState().pushSnapshot('s1', content('b'));
    const list = hist('s1');
    expect(list.map(s => s.preview)).toEqual(['a', 'b']);
    expect(store.getState().currentSnapshotId['s1']).toBe(list[1].id);
  });

  it('caps the timeline, dropping the oldest', () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 15; i++) {
      store.getState().pushSnapshot('s1', content(`state ${i}`));
    }
    const list = hist('s1');
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    // The very first states fell off the front.
    expect(list[0].preview).toBe(`state ${15}`);
    expect(list[list.length - 1].preview).toBe(`state ${MAX_SNAPSHOTS + 14}`);
  });

  it('keeps each section independent', () => {
    store.getState().pushSnapshot('s1', content('one'));
    store.getState().pushSnapshot('s2', content('two'));
    expect(hist('s1')).toHaveLength(1);
    expect(hist('s2')).toHaveLength(1);
  });

  it('markCurrentSnapshot moves the pointer without changing the list', () => {
    store.getState().pushSnapshot('s1', content('a'));
    store.getState().pushSnapshot('s1', content('b'));
    const first = hist('s1')[0].id;
    store.getState().markCurrentSnapshot('s1', first);
    expect(store.getState().currentSnapshotId['s1']).toBe(first);
    expect(hist('s1')).toHaveLength(2);
  });

  it('clearSectionHistory drops a section entirely', () => {
    store.getState().pushSnapshot('s1', content('a'));
    store.getState().clearSectionHistory('s1');
    expect(store.getState().historyBySection['s1']).toBeUndefined();
    expect(store.getState().currentSnapshotId['s1']).toBeUndefined();
  });
});
