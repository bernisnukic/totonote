import type {
  Document,
  Section,
  Tag,
  Category,
  Annotation,
  DocumentTagWithDetails,
  SectionTagWithDetails,
  BrowseCategory,
  CategoryRule,
  CreateCategoryInput,
  CreateCategoryResult,
  ApplyRuleResult,
  BulkAddSubcategoryInput,
  BulkAddSubcategoryResult,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateSectionInput,
  UpdateSectionInput,
  CreateTagInput,
  UpdateTagInput,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  PositionUpdate,
} from './domain-types';

export interface IpcHandlerMap {
  // Documents
  'document:list': { args: void; result: Document[] };
  'document:get': { args: { id: string }; result: Document | null };
  'document:create': { args: CreateDocumentInput; result: Document };
  'document:update': { args: UpdateDocumentInput; result: Document };
  'document:delete': { args: { id: string }; result: void };

  // Sections
  'section:list': { args: { documentId: string }; result: Section[] };
  'section:get': { args: { id: string }; result: Section | null };
  'section:create': { args: CreateSectionInput; result: Section };
  'section:update': { args: UpdateSectionInput; result: Section };
  'section:delete': { args: { id: string }; result: void };
  'section:reorder': { args: { documentId: string; orderedIds: string[] }; result: void };

  // Tags & Categories
  'tag:list': { args: { categoryId?: string }; result: Tag[] };
  'tag:create': { args: CreateTagInput; result: Tag };
  'tag:update': { args: UpdateTagInput; result: Tag };
  'tag:delete': { args: { id: string }; result: void };
  'tag:search': { args: { query: string }; result: Tag[] };
  'category:list': { args: void; result: Category[] };
  'category:create': { args: CreateCategoryInput; result: CreateCategoryResult };
  'category:update': { args: { id: string; name?: string; parentId?: string | null }; result: Category };
  /** Returns every id removed — the category and all its descendants. */
  'category:delete': { args: { id: string }; result: string[] };
  'category:bulk-add-child': { args: BulkAddSubcategoryInput; result: BulkAddSubcategoryResult };

  // Category Rules (sub-category skeletons)
  'category:rule-list': { args: void; result: CategoryRule[] };
  'category:rule-get': { args: { categoryId: string }; result: CategoryRule | null };
  'category:rule-set': { args: { categoryId: string; template: string }; result: CategoryRule | null };
  'category:rule-apply-existing': { args: { categoryId: string }; result: ApplyRuleResult };

  // Annotations
  'annotation:list': { args: { sectionId: string }; result: Annotation[] };
  'annotation:list-by-document': { args: { documentId: string }; result: Annotation[] };
  'annotation:create': { args: CreateAnnotationInput; result: Annotation };
  'annotation:update': { args: UpdateAnnotationInput; result: Annotation };
  'annotation:delete': { args: { id: string }; result: void };
  'annotation:batch-update-positions': { args: { updates: PositionUpdate[] }; result: void };

  // Section Tags
  'section-tag:list': { args: { sectionId: string }; result: SectionTagWithDetails[] };
  'section-tag:add': { args: { sectionId: string; tagId: string }; result: void };
  'section-tag:remove': { args: { sectionId: string; tagId: string }; result: void };
  'section-tag:list-by-document': { args: { documentId: string }; result: SectionTagWithDetails[] };

  // Document Tags (right sidebar)
  'document-tag:list': { args: { documentId: string }; result: DocumentTagWithDetails[] };
  'document-tag:add': { args: { documentId: string; tagId: string; categoryId: string }; result: void };
  'document-tag:remove': { args: { documentId: string; tagId: string }; result: void };

  // Browse Categories (left sidebar)
  'browse-category:list': { args: void; result: BrowseCategory[] };

  // Preferences
  'preference:get': { args: { key: string }; result: string | null };
  'preference:set': { args: { key: string; value: string }; result: void };

  // App / Updates
  'app:check-for-updates': {
    args: void;
    result: {
      available: boolean;
      currentVersion: string;
      latestVersion?: string;
      releaseUrl?: string;
    };
  };
  'app:open-external': { args: { url: string }; result: void };
}

export type IpcChannel = keyof IpcHandlerMap;
