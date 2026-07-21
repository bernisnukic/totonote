import type { StateCreator } from 'zustand';
import type {
  Tag,
  Category,
  DocumentTagWithDetails,
  SectionTagWithDetails,
  ApplyRuleResult,
  BulkAddSubcategoryResult,
} from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';
// Typed against the whole store so deletions can offer an undo; type-only, so no
// runtime cycle with stores/index.ts.
import type { AppStore } from './index';

export interface TagSlice {
  tags: Tag[];
  categories: Category[];
  /** categoryId → raw rule template. Absent means the category has no rule. */
  categoryRules: Record<string, string>;
  documentTags: DocumentTagWithDetails[];
  sectionTags: SectionTagWithDetails[];

  loadTags: (categoryId?: string) => Promise<void>;
  loadCategories: () => Promise<void>;
  loadCategoryRules: () => Promise<void>;
  createTag: (categoryId: string, name: string, color?: string) => Promise<Tag>;
  updateTag: (id: string, updates: { name?: string; color?: string; description?: string; categoryId?: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  searchTags: (query: string) => Promise<Tag[]>;

  createCategory: (name: string, parentId?: string, applyRule?: boolean) => Promise<Category>;
  updateCategory: (id: string, updates: { name?: string; parentId?: string | null }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  setCategoryRule: (categoryId: string, template: string) => Promise<void>;
  applyRuleToExisting: (categoryId: string) => Promise<ApplyRuleResult>;
  bulkAddSubcategory: (
    parentIds: string[],
    name: string,
    applyRule: boolean,
  ) => Promise<BulkAddSubcategoryResult>;

  loadDocumentTags: (documentId: string) => Promise<void>;
  addDocumentTag: (documentId: string, tagId: string, categoryId: string) => Promise<void>;
  removeDocumentTag: (documentId: string, tagId: string) => Promise<void>;

  loadSectionTagsByDocument: (documentId: string) => Promise<void>;
  addSectionTag: (sectionId: string, tagId: string, documentId: string) => Promise<void>;
  removeSectionTag: (sectionId: string, tagId: string, documentId: string) => Promise<void>;
}

export const createTagSlice: StateCreator<AppStore, [], [], TagSlice> = (set, get) => ({
  tags: [],
  categories: [],
  categoryRules: {},
  documentTags: [],
  sectionTags: [],

  loadTags: async (categoryId) => {
    const tags = await invoke('tag:list', { categoryId });
    set({ tags });
  },

  loadCategories: async () => {
    const categories = await invoke('category:list', { workspaceId: get().activeWorkspaceId ?? undefined });
    set({ categories });
  },

  loadCategoryRules: async () => {
    const rules = await invoke('category:rule-list');
    set({ categoryRules: Object.fromEntries(rules.map(r => [r.categoryId, r.template])) });
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
    const snapshot = await invoke('tag:delete', { id });
    get().offerUndo(snapshot);
    // Deleting a tag cascades in the database — its annotations, section tags and
    // document tags go with it. Mirror that here, or their badges linger in the UI
    // until the next reload.
    set(s => ({
      tags: s.tags.filter(t => t.id !== id),
      sectionTags: s.sectionTags.filter(st => st.tagId !== id),
      documentTags: s.documentTags.filter(dt => dt.tagId !== id),
    }));
  },

  searchTags: async (query) => {
    return invoke('tag:search', { query });
  },

  createCategory: async (name, parentId, applyRule) => {
    // Roots need a workspace; children inherit their parent's.
    const { category, descendants } = await invoke('category:create', {
      name,
      parentId,
      applyRule,
      workspaceId: get().activeWorkspaceId ?? undefined,
    });
    set(s => ({ categories: [...s.categories, category, ...descendants] }));
    return category;
  },

  updateCategory: async (id, updates) => {
    const category = await invoke('category:update', { id, ...updates });
    set(s => ({ categories: s.categories.map(c => (c.id === id ? category : c)) }));
  },

  deleteCategory: async (id) => {
    // The main process deletes descendants too, and returns every id it removed.
    const { removedIds, snapshot } = await invoke('category:delete', { id });
    get().offerUndo(snapshot);
    const removed = new Set(removedIds);
    set(s => {
      const categoryRules = { ...s.categoryRules };
      for (const removedId of removed) delete categoryRules[removedId];
      return {
        categories: s.categories.filter(c => !removed.has(c.id)),
        tags: s.tags.filter(t => !removed.has(t.categoryId)),
        categoryRules,
      };
    });
  },

  setCategoryRule: async (categoryId, template) => {
    const rule = await invoke('category:rule-set', { categoryId, template });
    set(s => {
      const categoryRules = { ...s.categoryRules };
      // A template with nothing usable in it clears the rule.
      if (rule) categoryRules[categoryId] = rule.template;
      else delete categoryRules[categoryId];
      return { categoryRules };
    });
  },

  applyRuleToExisting: async (categoryId) => {
    const result = await invoke('category:rule-apply-existing', { categoryId });
    set(s => ({ categories: [...s.categories, ...result.created] }));
    return result;
  },

  bulkAddSubcategory: async (parentIds, name, applyRule) => {
    const result = await invoke('category:bulk-add-child', { parentIds, name, applyRule });
    set(s => ({ categories: [...s.categories, ...result.created] }));
    return result;
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
