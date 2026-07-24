// @vitest-environment jsdom
// (undo-slice reaches main through window.api, so these need a DOM global)
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createFilterSlice, type FilterSlice } from './filter-slice';
import {
  createUiSlice,
  type UiSlice,
  DEFAULT_LEFT_SIDEBAR_WIDTH,
  DEFAULT_RIGHT_SIDEBAR_WIDTH,
} from './ui-slice';
import { createUndoSlice, type UndoSlice } from './undo-slice';
import type { DeletionSnapshot } from '../../shared/domain-types';

/**
 * The view-state slices: filtering, panel layout and the undo offer. They hold no I/O, so
 * each is exercised on its own vanilla store rather than through the composed app store.
 */

// ─── filter-slice ──────────────────────────────────────────────────────

describe('filter slice', () => {
  let store: StoreApi<FilterSlice>;
  beforeEach(() => {
    store = createStore<FilterSlice>((...a) => createFilterSlice(...a));
  });

  it('starts in search mode, document order, nothing filtered', () => {
    const s = store.getState();
    expect(s.leftSidebarMode).toBe('search');
    expect(s.documentSort).toBe('document');
    expect(s.activeFilters).toEqual({});
    expect(s.searchQuery).toBe('');
  });

  it('toggleFilter adds then removes a value within its category', () => {
    store.getState().toggleFilter('cat-1', 'tag-a');
    expect(store.getState().activeFilters['cat-1']).toEqual(['tag-a']);
    store.getState().toggleFilter('cat-1', 'tag-b');
    expect(store.getState().activeFilters['cat-1']).toEqual(['tag-a', 'tag-b']);
    store.getState().toggleFilter('cat-1', 'tag-a');
    expect(store.getState().activeFilters['cat-1']).toEqual(['tag-b']);
  });

  it('keeps categories independent', () => {
    store.getState().toggleFilter('cat-1', 'tag-a');
    store.getState().toggleFilter('cat-2', 'tag-a');
    expect(store.getState().activeFilters).toEqual({ 'cat-1': ['tag-a'], 'cat-2': ['tag-a'] });
  });

  it('clearFilters also empties the search box (a documented surprise)', () => {
    store.getState().setSearch('dragon');
    store.getState().toggleFilter('cat-1', 'tag-a');
    store.getState().clearFilters();
    expect(store.getState().activeFilters).toEqual({});
    expect(store.getState().searchQuery).toBe('');
  });

  it('records the chosen excerpt sort and sidebar mode', () => {
    store.getState().setDocumentSort('newest');
    store.getState().setLeftSidebarMode('sort');
    expect(store.getState().documentSort).toBe('newest');
    expect(store.getState().leftSidebarMode).toBe('sort');
  });
});

// ─── ui-slice ──────────────────────────────────────────────────────────

describe('ui slice', () => {
  let store: StoreApi<UiSlice>;
  beforeEach(() => {
    store = createStore<UiSlice>((...a) => createUiSlice(...a));
  });

  it('resetSidebarWidths puts both panels back to their defaults', () => {
    store.getState().setLeftSidebarWidth(390);
    store.getState().setRightSidebarWidth(altWidth());
    store.getState().resetSidebarWidths();
    expect(store.getState().leftSidebarWidth).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH);
    expect(store.getState().rightSidebarWidth).toBe(DEFAULT_RIGHT_SIDEBAR_WIDTH);
  });

  it('resets one side without disturbing the other', () => {
    store.getState().setLeftSidebarWidth(390);
    store.getState().setRightSidebarWidth(altWidth());
    store.getState().resetLeftSidebarWidth();
    expect(store.getState().leftSidebarWidth).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH);
    expect(store.getState().rightSidebarWidth).toBe(altWidth());
  });

  it('toggles each sidebar independently', () => {
    store.getState().toggleLeftSidebar();
    expect(store.getState().leftSidebarCollapsed).toBe(true);
    expect(store.getState().rightSidebarCollapsed).toBe(false);
    store.getState().toggleLeftSidebar();
    expect(store.getState().leftSidebarCollapsed).toBe(false);
  });

  it('focusing a tag clears any focused category, and vice versa', () => {
    // The Info panel shows one page at a time; both set would be ambiguous.
    store.getState().setFocusedCategory('cat-1');
    expect(store.getState().focusedCategoryId).toBe('cat-1');
    store.getState().setFocusedTag('tag-1');
    expect(store.getState().focusedTagId).toBe('tag-1');
    expect(store.getState().focusedCategoryId).toBeNull();
    store.getState().setFocusedCategory('cat-2');
    expect(store.getState().focusedTagId).toBeNull();
  });

  it('focusing a page switches the right sidebar to the Info tab', () => {
    store.getState().setActiveRightTab('edit');
    store.getState().setFocusedTag('tag-1');
    expect(store.getState().activeRightTab).toBe('info');
  });

  it('opening and closing help tracks the current page', () => {
    expect(store.getState().helpPage).toBeNull();
    store.getState().openHelp('glossary');
    expect(store.getState().helpPage).toBe('glossary');
    store.getState().closeHelp();
    expect(store.getState().helpPage).toBeNull();
  });

  it('tracks the popped-out wiki view', () => {
    store.getState().setWikiOpen(true);
    expect(store.getState().wikiOpen).toBe(true);
    store.getState().setWikiOpen(false);
    expect(store.getState().wikiOpen).toBe(false);
  });

  it('opens and closes modals by id', () => {
    store.getState().openModal('settings');
    expect(store.getState().modals.settings).toBe(true);
    store.getState().closeModal('settings');
    expect(store.getState().modals.settings).toBe(false);
  });
});

/** A right-panel width that is deliberately not the default, so resets are observable. */
function altWidth() {
  return DEFAULT_RIGHT_SIDEBAR_WIDTH + 70;
}

// ─── undo-slice ────────────────────────────────────────────────────────

const snapshot = (rows: DeletionSnapshot['rows']): DeletionSnapshot =>
  ({ kind: 'section', label: 'Chapter One', rows }) as DeletionSnapshot;

describe('undo slice', () => {
  let store: StoreApi<UndoSlice>;
  beforeEach(() => {
    store = createStore<UndoSlice>((...a) => createUndoSlice(...a));
    (window as unknown as { api: { invoke: () => Promise<unknown> } }).api = {
      invoke: () => Promise.resolve(undefined),
    };
  });

  it('offers an undo describing what was deleted', () => {
    store.getState().offerUndo(snapshot({ sections: [{ id: 's1' }] } as never));
    expect(store.getState().pendingUndo?.message).toBe('Section "Chapter One" deleted');
  });

  it('ignores a snapshot that removed nothing', () => {
    // Nothing was destroyed, so there is nothing to offer to put back.
    store.getState().offerUndo(snapshot({ sections: [] } as never));
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('only ever offers the most recent deletion', () => {
    store.getState().offerUndo(snapshot({ sections: [{ id: 's1' }] } as never));
    const first = store.getState().pendingUndo?.id;
    store.getState().offerUndo(snapshot({ sections: [{ id: 's2' }] } as never));
    expect(store.getState().pendingUndo?.id).not.toBe(first);
  });

  it('performUndo returns the snapshot and clears the offer', async () => {
    store.getState().offerUndo(snapshot({ sections: [{ id: 's1' }] } as never));
    const result = await store.getState().performUndo();
    expect(result?.label).toBe('Chapter One');
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('performUndo is a no-op when nothing is pending', async () => {
    expect(await store.getState().performUndo()).toBeNull();
  });

  it('dismissUndo drops the offer without restoring', () => {
    store.getState().offerUndo(snapshot({ sections: [{ id: 's1' }] } as never));
    store.getState().dismissUndo();
    expect(store.getState().pendingUndo).toBeNull();
  });
});
