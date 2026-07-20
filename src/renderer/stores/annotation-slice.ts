import type { StateCreator } from 'zustand';
import type { Annotation, AnnotationPlacement, PositionUpdate } from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';

export interface AnnotationSlice {
  annotations: Annotation[];
  documentAnnotations: Annotation[];
  highlightsVisible: boolean;
  /** Tags whose highlights are individually switched off in HL mode. */
  hiddenTagIds: string[];

  loadAnnotations: (sectionId: string) => Promise<void>;
  loadDocumentAnnotations: (documentId: string) => Promise<void>;
  createAnnotation: (
    sectionId: string,
    tagId: string,
    fromPos: number,
    toPos: number,
    note?: string,
    categoryId?: string | null,
  ) => Promise<Annotation>;
  updateAnnotation: (
    id: string,
    updates: { fromPos?: number; toPos?: number; note?: string; tagId?: string; categoryId?: string | null },
  ) => Promise<void>;
  loadPlacements: (filter: { categoryIds?: string[]; tagId?: string }) => Promise<AnnotationPlacement[]>;
  reorderPlacements: (categoryId: string, orderedIds: string[]) => Promise<void>;
  toggleTagHighlight: (tagId: string) => void;
  deleteAnnotation: (id: string) => Promise<void>;
  batchUpdatePositions: (updates: PositionUpdate[]) => Promise<void>;
  setHighlightsVisible: (visible: boolean) => void;
  clearAnnotations: () => void;
}

export const createAnnotationSlice: StateCreator<AnnotationSlice, [], [], AnnotationSlice> = (set) => ({
  annotations: [],
  documentAnnotations: [],
  highlightsVisible: true,
  hiddenTagIds: [],

  loadAnnotations: async (sectionId) => {
    const annotations = await invoke('annotation:list', { sectionId });
    set({ annotations });
  },

  loadDocumentAnnotations: async (documentId) => {
    const documentAnnotations = await invoke('annotation:list-by-document', { documentId });
    set({ documentAnnotations });
  },

  createAnnotation: async (sectionId, tagId, fromPos, toPos, note, categoryId) => {
    const annotation = await invoke('annotation:create', { sectionId, tagId, fromPos, toPos, note, categoryId });
    set(s => ({
      annotations: [...s.annotations, annotation],
      documentAnnotations: [...s.documentAnnotations, annotation],
    }));
    return annotation;
  },

  updateAnnotation: async (id, updates) => {
    const annotation = await invoke('annotation:update', { id, ...updates });
    set(s => ({
      annotations: s.annotations.map(a => (a.id === id ? annotation : a)),
      documentAnnotations: s.documentAnnotations.map(a => (a.id === id ? annotation : a)),
    }));
  },

  deleteAnnotation: async (id) => {
    await invoke('annotation:delete', { id });
    set(s => ({
      annotations: s.annotations.filter(a => a.id !== id),
      documentAnnotations: s.documentAnnotations.filter(a => a.id !== id),
    }));
  },

  batchUpdatePositions: async (updates) => {
    await invoke('annotation:batch-update-positions', { updates });
    const updateMap = (a: Annotation) => {
      const update = updates.find(u => u.id === a.id);
      return update ? { ...a, fromPos: update.fromPos, toPos: update.toPos } : a;
    };
    set(s => ({
      annotations: s.annotations.map(updateMap),
      documentAnnotations: s.documentAnnotations.map(updateMap),
    }));
  },

  setHighlightsVisible: (visible) => set({ highlightsVisible: visible }),

  loadPlacements: async (filter) => {
    return invoke('annotation:placements', filter);
  },

  reorderPlacements: async (categoryId, orderedIds) => {
    await invoke('annotation:reorder-placements', { categoryId, orderedIds });
  },

  toggleTagHighlight: (tagId) =>
    set(s => ({
      hiddenTagIds: s.hiddenTagIds.includes(tagId)
        ? s.hiddenTagIds.filter(id => id !== tagId)
        : [...s.hiddenTagIds, tagId],
    })),

  clearAnnotations: () => set({ annotations: [], documentAnnotations: [] }),
});
