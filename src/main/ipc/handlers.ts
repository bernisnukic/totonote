import { ipcMain, shell } from 'electron';
import * as workspaceRepo from '../db/repositories/workspace-repo';
import * as documentRepo from '../db/repositories/document-repo';
import * as sectionRepo from '../db/repositories/section-repo';
import * as tagRepo from '../db/repositories/tag-repo';
import * as categoryRepo from '../db/repositories/category-repo';
import * as categoryRuleRepo from '../db/repositories/category-rule-repo';
import * as undoRepo from '../db/repositories/undo-repo';
import * as annotationRepo from '../db/repositories/annotation-repo';
import * as sectionTagRepo from '../db/repositories/section-tag-repo';
import * as preferenceRepo from '../db/repositories/preference-repo';
import { checkForUpdates } from '../services/update-checker';
import type { CreateCategoryInput, BulkAddSubcategoryInput } from '../../shared/domain-types';

const ALLOWED_EXTERNAL_PREFIX = 'https://github.com/bernisnukic/totonote/';

export function registerIpcHandlers(): void {
  // Workspaces
  ipcMain.handle('workspace:list', () => workspaceRepo.listWorkspaces());
  ipcMain.handle('workspace:create', (_, args: { name: string }) => workspaceRepo.createWorkspace(args.name));
  ipcMain.handle('workspace:rename', (_, args: { id: string; name: string }) =>
    workspaceRepo.renameWorkspace(args.id, args.name)
  );
  ipcMain.handle('workspace:delete', (_, args: { id: string }) => workspaceRepo.deleteWorkspace(args.id));

  // Documents
  ipcMain.handle('document:list', (_, args: { workspaceId?: string }) =>
    documentRepo.listDocuments(args?.workspaceId)
  );
  ipcMain.handle('document:get', (_, args: { id: string }) => documentRepo.getDocument(args.id));
  ipcMain.handle('document:create', (_, args) => documentRepo.createDocument(args));
  ipcMain.handle('document:update', (_, args) => documentRepo.updateDocument(args));
  ipcMain.handle('document:delete', (_, args: { id: string }) => documentRepo.deleteDocument(args.id));

  // Sections
  ipcMain.handle('section:list', (_, args: { documentId: string }) => sectionRepo.listSections(args.documentId));
  ipcMain.handle('section:get', (_, args: { id: string }) => sectionRepo.getSection(args.id));
  ipcMain.handle('section:create', (_, args) => sectionRepo.createSection(args));
  ipcMain.handle('section:update', (_, args) => sectionRepo.updateSection(args));
  ipcMain.handle('section:delete', (_, args: { id: string }) => sectionRepo.deleteSection(args.id));
  ipcMain.handle('section:reorder', (_, args: { documentId: string; orderedIds: string[] }) =>
    sectionRepo.reorderSections(args.documentId, args.orderedIds)
  );

  // Tags & Categories
  ipcMain.handle('tag:list', (_, args: { categoryId?: string }) => tagRepo.listTags(args?.categoryId));
  ipcMain.handle('tag:create', (_, args) => tagRepo.createTag(args));
  ipcMain.handle('tag:update', (_, args) => tagRepo.updateTag(args));
  ipcMain.handle('tag:delete', (_, args: { id: string }) => tagRepo.deleteTag(args.id));
  ipcMain.handle('tag:search', (_, args: { query: string }) => tagRepo.searchTags(args.query));
  ipcMain.handle('category:list', (_, args: { workspaceId?: string }) =>
    categoryRepo.listCategories(args?.workspaceId)
  );
  ipcMain.handle('category:create', (_, args: CreateCategoryInput) => categoryRepo.createCategory(args));
  ipcMain.handle('category:update', (_, args: { id: string; name?: string; parentId?: string | null }) => categoryRepo.updateCategory(args.id, { name: args.name, parentId: args.parentId }));
  ipcMain.handle('category:delete', (_, args: { id: string }) => categoryRepo.deleteCategory(args.id));
  ipcMain.handle('category:bulk-add-child', (_, args: BulkAddSubcategoryInput) => categoryRepo.bulkAddSubcategory(args));

  // Category Rules
  ipcMain.handle('category:rule-list', () => categoryRuleRepo.listCategoryRules());
  ipcMain.handle('category:rule-get', (_, args: { categoryId: string }) => categoryRuleRepo.getCategoryRule(args.categoryId));
  ipcMain.handle('category:rule-set', (_, args: { categoryId: string; template: string }) =>
    categoryRuleRepo.setCategoryRule(args.categoryId, args.template)
  );
  ipcMain.handle('category:rule-apply-existing', (_, args: { categoryId: string }) =>
    categoryRepo.applyRuleToExistingChildren(args.categoryId)
  );

  // Annotations
  ipcMain.handle('annotation:list', (_, args: { sectionId: string }) => annotationRepo.listAnnotations(args.sectionId));
  ipcMain.handle('annotation:list-by-document', (_, args: { documentId: string }) => annotationRepo.listAnnotationsByDocument(args.documentId));
  ipcMain.handle('annotation:create', (_, args) => annotationRepo.createAnnotation(args));
  ipcMain.handle('annotation:update', (_, args) => annotationRepo.updateAnnotation(args));
  ipcMain.handle('annotation:delete', (_, args: { id: string }) => annotationRepo.deleteAnnotation(args.id));
  ipcMain.handle('annotation:batch-update-positions', (_, args: { updates: Array<{ id: string; fromPos: number; toPos: number }> }) =>
    annotationRepo.batchUpdatePositions(args.updates)
  );
  ipcMain.handle('annotation:placements', (_, args: { categoryIds?: string[]; tagId?: string }) =>
    annotationRepo.listPlacements(args ?? {})
  );
  ipcMain.handle('annotation:reorder-placements', (_, args: { categoryId: string; orderedIds: string[] }) =>
    annotationRepo.reorderPlacements(args.categoryId, args.orderedIds)
  );
  ipcMain.handle('annotation:filing-edges', () => annotationRepo.listFilingEdges());

  // Section Tags
  ipcMain.handle('section-tag:list', (_, args: { sectionId: string }) => sectionTagRepo.listSectionTags(args.sectionId));
  ipcMain.handle('section-tag:add', (_, args: { sectionId: string; tagId: string }) => sectionTagRepo.addSectionTag(args.sectionId, args.tagId));
  ipcMain.handle('section-tag:remove', (_, args: { sectionId: string; tagId: string }) => sectionTagRepo.removeSectionTag(args.sectionId, args.tagId));
  ipcMain.handle('section-tag:list-by-document', (_, args: { documentId: string }) => sectionTagRepo.listSectionTagsByDocument(args.documentId));

  // Document Tags
  ipcMain.handle('document-tag:list', (_, args: { documentId: string }) => preferenceRepo.listDocumentTags(args.documentId));
  ipcMain.handle('document-tag:add', (_, args: { documentId: string; tagId: string; categoryId: string }) =>
    preferenceRepo.addDocumentTag(args.documentId, args.tagId, args.categoryId)
  );
  ipcMain.handle('document-tag:remove', (_, args: { documentId: string; tagId: string }) =>
    preferenceRepo.removeDocumentTag(args.documentId, args.tagId)
  );

  // Browse Categories
  ipcMain.handle('browse-category:list', () => categoryRepo.listBrowseCategories());

  // Preferences
  ipcMain.handle('preference:get', (_, args: { key: string }) => preferenceRepo.getPreference(args.key));
  ipcMain.handle('preference:set', (_, args: { key: string; value: string }) => preferenceRepo.setPreference(args.key, args.value));

  // App / Updates
  // Undo
  ipcMain.handle('undo:restore', (_, args: { snapshot: Parameters<typeof undoRepo.restoreSnapshot>[0] }) =>
    undoRepo.restoreSnapshot(args.snapshot)
  );

  ipcMain.handle('app:check-for-updates', () => checkForUpdates());
  ipcMain.handle('app:open-external', (_, args: { url: string }) => {
    if (!args.url.startsWith(ALLOWED_EXTERNAL_PREFIX)) {
      throw new Error('External URL not allowed');
    }
    return shell.openExternal(args.url);
  });
}
