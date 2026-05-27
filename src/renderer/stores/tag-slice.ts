import type { StateCreator } from 'zustand';
import type { Tag, Category, DocumentTagWithDetails, SectionTagWithDetails } from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';

export interface TagSlice {
  tags: Tag[];
  categories: Category[];
  documentTags: DocumentTagWithDetails[];
  sectionTags: SectionTagWithDetails[];

  loadTags: (categoryId?: string) => Promise<void>;
  loadCategories: () => Promise<void>;
  createTag: (categoryId: string, name: string, color?: string) => Promise<Tag>;
  updateTag: (id: string, updates: { name?: string; color?: string; description?: string; categoryId?: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  searchTags: (query: string) => Promise<Tag[]>;

  createCategory: (name: string, parentId?: string) => Promise<Category>;
  updateCategory: (id: string, updates: { name?: string; parentId?: string | null }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  loadDocumentTags: (documentId: string) => Promise<void>;
  addDocumentTag: (documentId: string, tagId: string, categoryId: string) => Promise<void>;
  removeDocumentTag: (documentId: string, tagId: string) => Promise<void>;

  loadSectionTagsByDocument: (documentId: string) => Promise<void>;
  addSectionTag: (sectionId: string, tagId: string, documentId: string) => Promise<void>;
  removeSectionTag: (sectionId: string, tagId: string, documentId: string) => Promise<void>;
}

export const createTagSlice: StateCreator<TagSlice, [], [], TagSlice> = (set) => ({
  tags: [],
  categories: [],
  documentTags: [],
  sectionTags: [],

  loadTags: async (categoryId) => {
    const tags = await invoke('tag:list', { categoryId });
    set({ tags });
  },

  loadCategories: async () => {
    const categories = await invoke('category:list');
    set({ categories });
  },

  createTag: async (categoryId, name, color) => {
    const tag = await invoke('tag:create', { categoryId, name, color });
    set(s => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  updateTag: async (id, updates) => {
    const tag = await invoke('tag:update', { id, ...updates });
    set(s => ({ tags: s.tags.map(t => (t.id === id ? tag : t)) }));
  },

  deleteTag: async (id) => {
    await invoke('tag:delete', { id });
    set(s => ({ tags: s.tags.filter(t => t.id !== id) }));
  },

  searchTags: async (query) => {
    return invoke('tag:search', { query });
  },

  createCategory: async (name, parentId) => {
    const category = await invoke('category:create', { name, parentId });
    set(s => ({ categories: [...s.categories, category] }));
    return category;
  },

  updateCategory: async (id, updates) => {
    const category = await invoke('category:update', { id, ...updates });
    set(s => ({ categories: s.categories.map(c => (c.id === id ? category : c)) }));
  },

  deleteCategory: async (id) => {
    await invoke('category:delete', { id });
    set(s => ({
      categories: s.categories.filter(c => c.id !== id),
      tags: s.tags.filter(t => t.categoryId !== id),
    }));
  },

  loadDocumentTags: async (documentId) => {
    const documentTags = await invoke('document-tag:list', { documentId });
    set({ documentTags });
  },

  addDocumentTag: async (documentId, tagId, categoryId) => {
    await invoke('document-tag:add', { documentId, tagId, categoryId });
    const documentTags = await invoke('document-tag:list', { documentId });
    set({ documentTags });
  },

  removeDocumentTag: async (documentId, tagId) => {
    await invoke('document-tag:remove', { documentId, tagId });
    set(s => ({ documentTags: s.documentTags.filter(dt => dt.tagId !== tagId) }));
  },

  loadSectionTagsByDocument: async (documentId) => {
    const sectionTags = await invoke('section-tag:list-by-document', { documentId });
    set({ sectionTags });
  },

  addSectionTag: async (sectionId, tagId, documentId) => {
    await invoke('section-tag:add', { sectionId, tagId });
    const sectionTags = await invoke('section-tag:list-by-document', { documentId });
    set({ sectionTags });
  },

  removeSectionTag: async (sectionId, tagId, documentId) => {
    await invoke('section-tag:remove', { sectionId, tagId });
    set(s => ({ sectionTags: s.sectionTags.filter(st => !(st.sectionId === sectionId && st.tagId === tagId)) }));
  },
});
