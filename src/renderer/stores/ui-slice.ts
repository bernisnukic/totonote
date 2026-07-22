import type { StateCreator } from 'zustand';

export type RightTab = 'info' | 'arrange' | 'edit';

/** Default panel widths — also what "reset" restores. */
export const DEFAULT_LEFT_SIDEBAR_WIDTH = 260;
export const DEFAULT_RIGHT_SIDEBAR_WIDTH = 260;

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
  /** Help page currently shown in the in-app guide, or null when closed. */
  helpPage: string | null;

  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  resetSidebarWidths: () => void;
  resetLeftSidebarWidth: () => void;
  resetRightSidebarWidth: () => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setActiveRightTab: (tab: RightTab) => void;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  setContextMenu: (menu: { x: number; y: number; type: string; annotationId?: string } | null) => void;
  setFocusedTag: (id: string | null) => void;
  setFocusedCategory: (id: string | null) => void;
  setGraphOpen: (open: boolean) => void;
  openHelp: (page: string) => void;
  closeHelp: () => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH,
  rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  activeRightTab: 'info',
  modals: {},
  contextMenu: null,
  focusedTagId: null,
  focusedCategoryId: null,
  graphOpen: false,
  helpPage: null,

  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: width }),
  setRightSidebarWidth: (width) => set({ rightSidebarWidth: width }),
  resetSidebarWidths: () =>
    set({
      leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH,
      rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
      leftSidebarCollapsed: false,
      rightSidebarCollapsed: false,
    }),
  resetLeftSidebarWidth: () => set({ leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH }),
  resetRightSidebarWidth: () => set({ rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH }),
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
  openHelp: (page) => set({ helpPage: page }),
  closeHelp: () => set({ helpPage: null }),
});
