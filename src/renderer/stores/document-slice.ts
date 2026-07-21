import type { StateCreator } from 'zustand';
import type { Document, Section } from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';
// Typed against the whole store so deletions can offer an undo (type-only import).
import type { AppStore } from './index';

export interface DocumentSlice {
  documents: Document[];
  activeDocumentId: string | null;
  activeDocument: Document | null;
  sections: Section[];
  activeSectionId: string | null;
  isLoading: boolean;
  isSaving: boolean;

  loadDocuments: () => Promise<void>;
  openDocument: (id: string) => Promise<void>;
  closeDocument: () => void;
  createDocument: (title: string, description?: string) => Promise<Document>;
  updateDocument: (id: string, updates: { title?: string; description?: string; sectionLabel?: string }) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  loadSections: (documentId: string) => Promise<void>;
  setActiveSection: (sectionId: string | null) => void;
  createSection: (title: string, abbreviation: string) => Promise<Section>;
  updateSection: (id: string, updates: { title?: string; abbreviation?: string; content?: string }) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  reorderSections: (orderedIds: string[]) => Promise<void>;
  saveContent: (sectionId: string, content: string) => Promise<void>;
}

export const createDocumentSlice: StateCreator<AppStore, [], [], DocumentSlice> = (set, get) => ({
  documents: [],
  activeDocumentId: null,
  activeDocument: null,
  sections: [],
  activeSectionId: null,
  isLoading: false,
  isSaving: false,

  loadDocuments: async () => {
    // Scoped to the active workspace — documents in other worlds stay out of sight.
    const documents = await invoke('document:list', { workspaceId: get().activeWorkspaceId ?? undefined });
    set({ documents });
  },

  openDocument: async (id) => {
    set({ isLoading: true });
    const [doc, sections] = await Promise.all([
      invoke('document:get', { id }),
      invoke('section:list', { documentId: id }),
    ]);
    set({
      activeDocumentId: id,
      activeDocument: doc,
      sections,
      activeSectionId: sections.length > 0 ? sections[0].id : null,
      isLoading: false,
    });
  },

  closeDocument: () => {
    set({
      activeDocumentId: null,
      activeDocument: null,
      sections: [],
      activeSectionId: null,
    });
  },

  createDocument: async (title, description) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error('No workspace selected');
    const doc = await invoke('document:create', { workspaceId, title, description });
    set(s => ({ documents: [doc, ...s.documents] }));
    return doc;
  },

  updateDocument: async (id, updates) => {
    const doc = await invoke('document:update', { id, ...updates });
    set(s => ({
      documents: s.documents.map(d => (d.id === id ? doc : d)),
      activeDocument: s.activeDocumentId === id ? doc : s.activeDocument,
    }));
  },

  deleteDocument: async (id) => {
    const snapshot = await invoke('document:delete', { id });
    get().offerUndo(snapshot);
    set(s => ({
      documents: s.documents.filter(d => d.id !== id),
      activeDocumentId: s.activeDocumentId === id ? null : s.activeDocumentId,
      activeDocument: s.activeDocumentId === id ? null : s.activeDocument,
    }));
  },

  loadSections: async (documentId) => {
    const sections = await invoke('section:list', { documentId });
    set({ sections });
  },

  setActiveSection: (sectionId) => {
    set({ activeSectionId: sectionId });
  },

  createSection: async (title, abbreviation) => {
    const { activeDocumentId, sections } = get();
    if (!activeDocumentId) throw new Error('No active document');
    const sortOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sortOrder)) + 1 : 0;
    const section = await invoke('section:create', {
      documentId: activeDocumentId,
      title,
      abbreviation,
      sortOrder,
    });
    set(s => ({ sections: [...s.sections, section] }));
    return section;
  },

  updateSection: async (id, updates) => {
    const section = await invoke('section:update', { id, ...updates });
    set(s => ({
      sections: s.sections.map(sec => (sec.id === id ? section : sec)),
    }));
  },

  deleteSection: async (id) => {
    const snapshot = await invoke('section:delete', { id });
    get().offerUndo(snapshot);
    set(s => {
      const remaining = s.sections.filter(sec => sec.id !== id);
      return {
        sections: remaining,
        // Pick the replacement from what's left — reading s.sections here would hand
        // back the id of the section just deleted.
        activeSectionId: s.activeSectionId === id ? (remaining[0]?.id ?? null) : s.activeSectionId,
      };
    });
  },

  reorderSections: async (orderedIds) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;
    await invoke('section:reorder', { documentId: activeDocumentId, orderedIds });
    set(s => ({
      sections: orderedIds
        .map((id, index) => {
          const sec = s.sections.find(sec => sec.id === id);
          return sec ? { ...sec, sortOrder: index } : null;
        })
        .filter(Boolean) as Section[],
    }));
  },

  saveContent: async (sectionId, content) => {
    set({ isSaving: true });
    await invoke('section:update', { id: sectionId, content });
    set(s => ({
      isSaving: false,
      sections: s.sections.map(sec =>
        sec.id === sectionId ? { ...sec, content, updatedAt: new Date().toISOString() } : sec
      ),
    }));
  },
});
