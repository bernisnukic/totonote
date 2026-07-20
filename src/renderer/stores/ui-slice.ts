import type { StateCreator } from 'zustand';

export type RightTab = 'info' | 'arrange' | 'edit';

export interface UiSlice {
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  activeRightTab: RightTab;
  modals: Record<string, boolean>;
  /**
   * `annotationId` is carried here rather than read from `activeAnnotationId` when the
   * menu acts. Opening the menu also opens the TagPopover, whose click-outside handler
   * runs on the *mousedown* of the click that picks a menu item and clears
   * `activeAnnotationId` before the click handler ever fires.
   */
  contextMenu: { x: number; y: number; type: string; annotationId?: string } | null;
  focusedTagId: string | null;
  /** Category whose compiled wiki page is showing in the Info tab. Mutually exclusive with focusedTagId. */
  focusedCategoryId: string | null;
  graphOpen: boolean;

  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setActiveRightTab: (tab: RightTab) => void;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  setContextMenu: (menu: { x: number; y: number; type: string; annotationId?: string } | null) => void;
  setFocusedTag: (id: string | null) => void;
  setFocusedCategory: (id: string | null) => void;
  setGraphOpen: (open: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  leftSidebarWidth: 260,
  rightSidebarWidth: 260,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  activeRightTab: 'info',
  modals: {},
  contextMenu: null,
  focusedTagId: null,
  focusedCategoryId: null,
  graphOpen: false,

  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: width }),
  setRightSidebarWidth: (width) => set({ rightSidebarWidth: width }),
  toggleLeftSidebar: () => set(s => ({ leftSidebarCollapsed: !s.leftSidebarCollapsed })),
  toggleRightSidebar: () => set(s => ({ rightSidebarCollapsed: !s.rightSidebarCollapsed })),
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  openModal: (id) => set(s => ({ modals: { ...s.modals, [id]: true } })),
  closeModal: (id) => set(s => ({ modals: { ...s.modals, [id]: false } })),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setFocusedTag: (id) =>
    set({
      focusedTagId: id,
      ...(id ? { activeRightTab: 'info' as RightTab, focusedCategoryId: null } : {}),
    }),
  setFocusedCategory: (id) =>
    set({
      focusedCategoryId: id,
      ...(id ? { activeRightTab: 'info' as RightTab, focusedTagId: null } : {}),
    }),
  setGraphOpen: (open) => set({ graphOpen: open }),
});
