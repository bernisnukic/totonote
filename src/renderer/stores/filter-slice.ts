import type { StateCreator } from 'zustand';

export type LeftSidebarMode = 'search' | 'sort' | 'filter' | 'highlight';

export interface FilterSlice {
  searchQuery: string;
  activeFilters: Record<string, string[]>;
  sortOrder: 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc';
  leftSidebarMode: LeftSidebarMode;

  setSearch: (query: string) => void;
  toggleFilter: (category: string, value: string) => void;
  clearFilters: () => void;
  setSortOrder: (order: FilterSlice['sortOrder']) => void;
  setLeftSidebarMode: (mode: LeftSidebarMode) => void;
}

export const createFilterSlice: StateCreator<FilterSlice, [], [], FilterSlice> = (set) => ({
  searchQuery: '',
  activeFilters: {},
  sortOrder: 'name-asc',
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

  setSortOrder: (order) => set({ sortOrder: order }),
  setLeftSidebarMode: (mode) => set({ leftSidebarMode: mode }),
});
