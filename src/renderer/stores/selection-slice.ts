import type { StateCreator } from 'zustand';

export interface SelectionSlice {
  selectedRange: { from: number; to: number } | null;
  activeAnnotationId: string | null;
  selectionToolbarPos: { x: number; y: number } | null;

  setSelection: (from: number, to: number) => void;
  clearSelection: () => void;
  setActiveAnnotation: (id: string | null) => void;
  setSelectionToolbarPos: (pos: { x: number; y: number } | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set) => ({
  selectedRange: null,
  activeAnnotationId: null,
  selectionToolbarPos: null,

  setSelection: (from, to) => set({ selectedRange: { from, to } }),
  clearSelection: () => set({ selectedRange: null, selectionToolbarPos: null }),
  setActiveAnnotation: (id) => set({ activeAnnotationId: id }),
  setSelectionToolbarPos: (pos) => set({ selectionToolbarPos: pos }),
});
