import type { StateCreator } from 'zustand';
import type { Annotation, PositionUpdate } from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';

export interface AnnotationSlice {
  annotations: Annotation[];
  documentAnnotations: Annotation[];
  highlightsVisible: boolean;

  loadAnnotations: (sectionId: string) => Promise<void>;
  loadDocumentAnnotations: (documentId: string) => Promise<void>;
  createAnnotation: (sectionId: string, tagId: string, fromPos: number, toPos: number, note?: string) => Promise<Annotation>;
  updateAnnotation: (id: string, updates: { fromPos?: number; toPos?: number; note?: string; tagId?: string }) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  batchUpdatePositions: (updates: PositionUpdate[]) => Promise<void>;
  setHighlightsVisible: (visible: boolean) => void;
  clearAnnotations: () => void;
}

export const createAnnotationSlice: StateCreator<AnnotationSlice, [], [], AnnotationSlice> = (set) => ({
  annotations: [],
  documentAnnotations: [],
  highlightsVisible: true,

  loadAnnotations: async (sectionId) => {
    const annotations = await invoke('annotation:list', { sectionId });
    set({ annotations });
  },

  loadDocumentAnnotations: async (documentId) => {
    const documentAnnotations = await invoke('annotation:list-by-document', { documentId });
    set({ documentAnnotations });
  },

  createAnnotation: async (sectionId, tagId, fromPos, toPos, note) => {
    const annotation = await invoke('annotation:create', { sectionId, tagId, fromPos, toPos, note });
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

  clearAnnotations: () => set({ annotations: [], documentAnnotations: [] }),
});
