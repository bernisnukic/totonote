import type { StateCreator } from 'zustand';

export interface SelectionSlice {
  selectedRange: { from: number; to: number } | null;
  /**
   * The section the selection is actually in.
   *
   * Not the same thing as the active section. All sections are on one page, each with its
   * own editor, and which one counts as "active" follows the scroll — so tagging just
   * after moving between sections could attach the highlight to the previous one, at
   * positions that mean nothing there. The editor that owns the selection knows for
   * certain, and says so.
   */
  selectedSectionId: string | null;
  activeAnnotationId: string | null;
  selectionToolbarPos: { x: number; y: number } | null;

  setSelection: (from: number, to: number, sectionId: string) => void;
  clearSelection: () => void;
  setActiveAnnotation: (id: string | null) => void;
  setSelectionToolbarPos: (pos: { x: number; y: number } | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set) => ({
  selectedRange: null,
  selectedSectionId: null,
  activeAnnotationId: null,
  selectionToolbarPos: null,

  setSelection: (from, to, sectionId) =>
    set({ selectedRange: { from, to }, selectedSectionId: sectionId }),
  clearSelection: () => set({ selectedRange: null, selectedSectionId: null, selectionToolbarPos: null }),
  setActiveAnnotation: (id) => set({ activeAnnotationId: id }),
  setSelectionToolbarPos: (pos) => set({ selectionToolbarPos: pos }),
});
