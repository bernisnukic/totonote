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
  MediaMeta,
  CreateMediaInput,
  DrawingRecord,
  SaveDrawingInput,
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

  // Embedded images. Bytes go in once on import and are served back over the
  // totonote:// protocol, so they never travel through IPC again.
  'media:create': { args: CreateMediaInput; result: MediaMeta };
  'media:get-meta': { args: { id: string }; result: MediaMeta | null };
  'media:usage': { args: void; result: { count: number; totalBytes: number } };
  'media:purge-unused': { args: void; result: { removed: number; drawingsRemoved: number } };

  // Drawings. Mutable, unlike media — the id stays put while the strokes are rewritten.
  'drawing:create': { args: { backgroundMediaId?: string | null; aspectRatio?: number }; result: DrawingRecord };
  'drawing:get': { args: { id: string }; result: DrawingRecord | null };
  'drawing:save': { args: SaveDrawingInput; result: DrawingRecord | null };

  // Unsaved-changes tracking (manual-save mode). The renderer tells main whether there's
  // unsaved work so the window can warn before closing; force-quit skips that warning.
  'window:set-dirty': { args: { dirty: boolean }; result: void };
  'app:force-quit': { args: void; result: void };
}

export type IpcChannel = keyof IpcHandlerMap;

/**
 * The same channel list at runtime, so the preload bridge can reject anything else.
 * `IPC_CHANNELS` and `IpcHandlerMap` are kept in step by the assertions below: add a
 * channel to one and forget the other and this file stops compiling.
 */
export const IPC_CHANNELS = [
  'workspace:list',
  'workspace:create',
  'workspace:rename',
  'workspace:delete',
  'document:list',
  'document:get',
  'document:create',
  'document:update',
  'document:delete',
  'section:list',
  'section:get',
  'section:create',
  'section:update',
  'section:delete',
  'section:reorder',
  'tag:list',
  'tag:create',
  'tag:update',
  'tag:delete',
  'tag:search',
  'category:list',
  'category:create',
  'category:update',
  'category:delete',
  'undo:restore',
  'category:bulk-add-child',
  'category:rule-list',
  'category:rule-get',
  'category:rule-set',
  'category:rule-apply-existing',
  'annotation:list',
  'annotation:list-by-document',
  'annotation:create',
  'annotation:update',
  'annotation:delete',
  'annotation:batch-update-positions',
  'annotation:placements',
  'annotation:reorder-placements',
  'annotation:filing-edges',
  'section-tag:list',
  'section-tag:add',
  'section-tag:remove',
  'section-tag:list-by-document',
  'document-tag:list',
  'document-tag:add',
  'document-tag:remove',
  'browse-category:list',
  'preference:get',
  'preference:set',
  'app:check-for-updates',
  'app:open-external',
  'app:version',
  'window:set-dirty',
  'app:force-quit',
  'media:create',
  'media:get-meta',
  'media:usage',
  'media:purge-unused',
  'drawing:create',
  'drawing:get',
  'drawing:save',
] as const;

type ListedChannel = (typeof IPC_CHANNELS)[number];
type Assert<T extends true> = T;
/* eslint-disable @typescript-eslint/no-unused-vars */
type _EveryChannelIsListed = Assert<[IpcChannel] extends [ListedChannel] ? true : false>;
type _EveryListedChannelExists = Assert<[ListedChannel] extends [IpcChannel] ? true : false>;
/* eslint-enable @typescript-eslint/no-unused-vars */

/** Runtime guard for the preload bridge. */
export function isIpcChannel(value: string): value is IpcChannel {
  return (IPC_CHANNELS as readonly string[]).includes(value);
}

