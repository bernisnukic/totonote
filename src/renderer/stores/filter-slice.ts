import type { StateCreator } from 'zustand';

export type LeftSidebarMode = 'search' | 'sort' | 'filter' | 'highlight';

/** How the Sort tab orders the whole document's tagged excerpts. */
export type ExcerptSort = 'document' | 'newest' | 'oldest' | 'tag';

export interface FilterSlice {
  searchQuery: string;
  activeFilters: Record<string, string[]>;
  documentSort: ExcerptSort;
  leftSidebarMode: LeftSidebarMode;

  setSearch: (query: string) => void;
  toggleFilter: (category: string, value: string) => void;
  clearFilters: () => void;
  setDocumentSort: (order: ExcerptSort) => void;
  setLeftSidebarMode: (mode: LeftSidebarMode) => void;
}

export const createFilterSlice: StateCreator<FilterSlice, [], [], FilterSlice> = (set) => ({
  searchQuery: '',
  activeFilters: {},
  documentSort: 'document',
  leftSidebarMode: 'search',

  setSearch: (query) => set({ searchQuery: query }),

  toggleFilter: (category, value) =>
    set(s => {
      const current = s.activeFilters[category] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return {
        activeFilters: {
          ...s.activeFilters,
          [category]: next,
        },
      };
    }),

  clearFilters: () => set({ activeFilters: {}, searchQuery: '' }),

  setDocumentSort: (order) => set({ documentSort: order }),
  setLeftSidebarMode: (mode) => set({ leftSidebarMode: mode }),
});
