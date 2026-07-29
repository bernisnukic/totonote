import type { StateCreator } from 'zustand';

export type RightTab = 'info' | 'arrange' | 'edit' | 'history';

/** Default panel widths — also what "reset" restores. */
export const DEFAULT_LEFT_SIDEBAR_WIDTH = 260;
export const DEFAULT_RIGHT_SIDEBAR_WIDTH = 260;

/** Where a right-click landed, and what the menu should therefore offer. */
export interface ContextMenuState {
  x: number;
  y: number;
  type: string;
  annotationId?: string;
  /**
   * Set when the click was on a picture or a drawing, so the menu can offer to delete it.
   *
   * Identified by what it *is* — a drawing's id, an image's source — rather than by a
   * document position: `posAtDOM` on a node view's wrapper does not reliably give the
   * position of the node itself, and a wrong one deletes nothing at all.
   */
  media?: { kind: 'image' | 'drawing'; key: string; width?: number | null };
}

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
  contextMenu: ContextMenuState | null;
  focusedTagId: string | null;
  /** Category whose compiled wiki page is showing in the Info tab. Mutually exclusive with focusedTagId. */
  focusedCategoryId: string | null;
  graphOpen: boolean;
  timelineOpen: boolean;
  /** Settings modal. In the store so ⌘, works anywhere, including the Documents screen. */
  settingsOpen: boolean;
  /** Help page currently shown in the in-app guide, or null when closed. */
  helpPage: string | null;
  /** The tag/category page is popped out full-screen as a wiki view. */
  wikiOpen: boolean;

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
  setContextMenu: (menu: ContextMenuState | null) => void;
  setFocusedTag: (id: string | null) => void;
  setFocusedCategory: (id: string | null) => void;
  setGraphOpen: (open: boolean) => void;
  setTimelineOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  openHelp: (page: string) => void;
  closeHelp: () => void;
  setWikiOpen: (open: boolean) => void;
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
  timelineOpen: false,
  settingsOpen: false,
  helpPage: null,
  wikiOpen: false,

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
  setTimelineOpen: (open) => set({ timelineOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  openHelp: (page) => set({ helpPage: page }),
  closeHelp: () => set({ helpPage: null }),
  setWikiOpen: (open) => set({ wikiOpen: open }),
});
