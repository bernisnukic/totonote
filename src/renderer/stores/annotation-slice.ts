import type { StateCreator } from 'zustand';
import type { Annotation, AnnotationPlacement, PositionUpdate } from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';
import { recordAnnotationEdit } from '../lib/edit-history';

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
    updates: {
      fromPos?: number;
      toPos?: number;
      note?: string;
      tagId?: string;
      categoryId?: string | null;
      whenText?: string;
    },
  ) => Promise<void>;
  loadPlacements: (filter: { categoryIds?: string[]; tagId?: string }) => Promise<AnnotationPlacement[]>;
  reorderPlacements: (categoryId: string, orderedIds: string[]) => Promise<void>;
  toggleTagHighlight: (tagId: string) => void;
  deleteAnnotation: (id: string) => Promise<void>;
  batchUpdatePositions: (updates: PositionUpdate[]) => Promise<void>;
  setHighlightsVisible: (visible: boolean) => void;
  clearAnnotations: () => void;
}

/**
 * Undo and redo recreate a highlight rather than resurrecting the same database row, so
 * each pass gives it a new id. This maps the id an undo entry was written against to
 * whatever id that highlight has now, so repeated undo/redo keeps working on the right one.
 */
const replacements = new Map<string, string>();

function rememberReplacement(originalId: string, newId: string): void {
  replacements.set(originalId, newId);
}

function latestIdFor(originalId: string): string {
  return replacements.get(originalId) ?? originalId;
}

export const createAnnotationSlice: StateCreator<AnnotationSlice, [], [], AnnotationSlice> = (set, get) => ({
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

    // Tagging is a step of its own in the undo order, so Ctrl+Z takes the tag off rather
    // than taking the words it was applied to as well. Recreating it keeps the same
    // range, tag and filing; only the id differs, which nothing outside here relies on.
    recordAnnotationEdit(sectionId, {
      label: 'tag',
      undo: async () => {
        const current = latestIdFor(annotation.id);
        await invoke('annotation:delete', { id: current });
        set(s => ({
          annotations: s.annotations.filter(a => a.id !== current),
          documentAnnotations: s.documentAnnotations.filter(a => a.id !== current),
        }));
      },
      redo: async () => {
        const remade = await invoke('annotation:create', { sectionId, tagId, fromPos, toPos, note, categoryId });
        rememberReplacement(annotation.id, remade.id);
        set(s => ({
          annotations: [...s.annotations, remade],
          documentAnnotations: [...s.documentAnnotations, remade],
        }));
      },
    });
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
    // Captured before it goes, so undo can put an identical one back.
    const gone =
      get().annotations.find(a => a.id === id) ?? get().documentAnnotations.find(a => a.id === id);
    await invoke('annotation:delete', { id });
    set(s => ({
      annotations: s.annotations.filter(a => a.id !== id),
      documentAnnotations: s.documentAnnotations.filter(a => a.id !== id),
    }));
    if (!gone) return;

    recordAnnotationEdit(gone.sectionId, {
      label: 'untag',
      undo: async () => {
        const remade = await invoke('annotation:create', {
          sectionId: gone.sectionId,
          tagId: gone.tagId,
          fromPos: gone.fromPos,
          toPos: gone.toPos,
          note: gone.note,
          categoryId: gone.categoryId,
        });
        rememberReplacement(id, remade.id);
        set(s => ({
          annotations: [...s.annotations, remade],
          documentAnnotations: [...s.documentAnnotations, remade],
        }));
      },
      redo: async () => {
        const current = latestIdFor(id);
        await invoke('annotation:delete', { id: current });
        set(s => ({
          annotations: s.annotations.filter(a => a.id !== current),
          documentAnnotations: s.documentAnnotations.filter(a => a.id !== current),
        }));
      },
    });
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
