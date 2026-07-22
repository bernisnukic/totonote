import type {
  Document,
  Section,
  Tag,
  Category,
  Annotation,
  AnnotationPlacement,
  Workspace,
  DeletionSnapshot,
  FilingEdge,
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
  // Workspaces
  'workspace:list': { args: void; result: Workspace[] };
  'workspace:create': { args: { name: string }; result: Workspace };
  'workspace:rename': { args: { id: string; name: string }; result: Workspace };
  'workspace:delete': { args: { id: string }; result: { remainingId: string } };

  // Documents
  'document:list': { args: { workspaceId?: string }; result: Document[] };
  'document:get': { args: { id: string }; result: Document | null };
  'document:create': { args: CreateDocumentInput; result: Document };
  'document:update': { args: UpdateDocumentInput; result: Document };
  'document:delete': { args: { id: string }; result: DeletionSnapshot };

  // Sections
  'section:list': { args: { documentId: string }; result: Section[] };
  'section:get': { args: { id: string }; result: Section | null };
  'section:create': { args: CreateSectionInput; result: Section };
  'section:update': { args: UpdateSectionInput; result: Section };
  'section:delete': { args: { id: string }; result: DeletionSnapshot };
  'section:reorder': { args: { documentId: string; orderedIds: string[] }; result: void };

  // Tags & Categories
  'tag:list': { args: { categoryId?: string }; result: Tag[] };
  'tag:create': { args: CreateTagInput; result: Tag };
  'tag:update': { args: UpdateTagInput; result: Tag };
  'tag:delete': { args: { id: string }; result: DeletionSnapshot };
  'tag:search': { args: { query: string }; result: Tag[] };
  'category:list': { args: { workspaceId?: string }; result: Category[] };
  'category:create': { args: CreateCategoryInput; result: CreateCategoryResult };
  'category:update': { args: { id: string; name?: string; parentId?: string | null }; result: Category };
  /** Returns every id removed — the category and all its descendants — plus an undo snapshot. */
  'category:delete': { args: { id: string }; result: { removedIds: string[]; snapshot: DeletionSnapshot } };
  /** Put back everything a delete destroyed. */
  'undo:restore': { args: { snapshot: DeletionSnapshot }; result: void };
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
  /** Filed annotations with computed excerpts, for the compiled wiki views. */
  'annotation:placements': {
    args: { categoryIds?: string[]; tagId?: string };
    result: AnnotationPlacement[];
  };
  'annotation:reorder-placements': { args: { categoryId: string; orderedIds: string[] }; result: void };
  /** Distinct tag→category filings, for the graph. */
  'annotation:filing-edges': { args: void; result: FilingEdge[] };

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
  'app:version': { args: void; result: string };
}

export type IpcChannel = keyof IpcHandlerMap;
