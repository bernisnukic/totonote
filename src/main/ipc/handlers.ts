import fs from 'node:fs';
import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron';
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
import * as mediaRepo from '../db/repositories/media-repo';
import * as drawingRepo from '../db/repositories/drawing-repo';
import * as searchRepo from '../db/repositories/search-repo';
import * as tagSetRepo from '../db/repositories/tag-set-repo';
import { queueImageForOcr } from '../services/ocr-queue';
import { mediaIdsInContent, drawingIdsInContent } from '../../shared/media-refs';
import { checkForUpdates } from '../services/update-checker';
import { inspectBackup, replaceDatabase, suggestedBackupName, writeBackup } from '../services/backup';
import { closeDb, getDbPath, getMigrationsFolder, getSqlite, initDb } from '../db/connection';
import type { CreateCategoryInput, BulkAddSubcategoryInput, CreateMediaInput } from '../../shared/domain-types';

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

  // Embedded images
  ipcMain.handle('media:create', (_, args: CreateMediaInput) => {
    const meta = mediaRepo.createMedia(args);
    // Not awaited: the picture should appear instantly and become searchable a moment later.
    // The straightened copy, when there is one, is read instead of the stored original —
    // it is never written to the database.
    queueImageForOcr(meta.id, args.readableData ? Buffer.from(args.readableData) : undefined);
    return meta;
  });
  ipcMain.handle('media:get-meta', (_, args: { id: string }) => mediaRepo.getMediaMeta(args.id));
  ipcMain.handle('media:usage', () => mediaRepo.mediaUsage());
  ipcMain.handle('media:purge-unused', () => {
    // An image counts as in use if any section still points at it — either directly, or as
    // the background of a drawing. A drawing node stores the background as a bare id with
    // no url, so scanning content alone would miss it and delete the map out from under
    // someone's annotations.
    const referencedMedia = new Set<string>();
    const referencedDrawings = new Set<string>();
    for (const content of sectionRepo.allSectionContent()) {
      for (const id of mediaIdsInContent(content)) referencedMedia.add(id);
      for (const id of drawingIdsInContent(content)) referencedDrawings.add(id);
    }
    for (const drawingId of referencedDrawings) {
      const background = drawingRepo.getDrawing(drawingId)?.backgroundMediaId;
      if (background) referencedMedia.add(background);
    }
    return {
      removed: mediaRepo.deleteUnusedMedia(referencedMedia),
      drawingsRemoved: drawingRepo.deleteUnusedDrawings(referencedDrawings),
    };
  });

  // Drawings
  ipcMain.handle('drawing:create', (_, args: { backgroundMediaId?: string | null; aspectRatio?: number }) =>
    drawingRepo.createDrawing(args ?? {})
  );
  ipcMain.handle('drawing:get', (_, args: { id: string }) => drawingRepo.getDrawing(args.id));
  ipcMain.handle('drawing:save', (_, args: { id: string; strokes: string }) => drawingRepo.saveDrawing(args));

  // Search
  ipcMain.handle('search:writing', (_, args: { query: string; workspaceId?: string }) =>
    searchRepo.searchWriting(args.query, args.workspaceId)
  );

  // Export
  ipcMain.handle('export:save-text', async (_, args: { suggestedName: string; contents: string }) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const { canceled, filePath } = await dialog.showSaveDialog(window!, {
      defaultPath: args.suggestedName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (canceled || !filePath) return null;
    await fs.promises.writeFile(filePath, args.contents, 'utf8');
    return filePath;
  });

  // Tag sets — named groups of tags applied together.
  ipcMain.handle('tag-set:list', (_, args: { workspaceId: string }) =>
    tagSetRepo.listTagSets(args.workspaceId)
  );
  ipcMain.handle('tag-set:create', (_, args: { workspaceId: string; name: string; tagIds: string[] }) =>
    tagSetRepo.createTagSet(args.workspaceId, args.name, args.tagIds)
  );
  ipcMain.handle('tag-set:update', (_, args: { id: string; name: string; tagIds: string[] }) =>
    tagSetRepo.updateTagSet(args.id, args.name, args.tagIds)
  );
  ipcMain.handle('tag-set:delete', (_, args: { id: string }) => tagSetRepo.deleteTagSet(args.id));

  ipcMain.handle('annotation:timeline', (_, args: { workspaceId?: string }) =>
    annotationRepo.listTimeline(args.workspaceId)
  );

  ipcMain.handle('document:backlinks', (_, args: { id: string }) => documentRepo.listBacklinks(args.id));

  // Backup — the whole world in one file
  ipcMain.handle('backup:status', () => {
    const dbPath = getDbPath();
    return { dbPath, bytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0 };
  });

  ipcMain.handle('backup:create', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const { canceled, filePath } = await dialog.showSaveDialog(window!, {
      title: 'Save a backup of everything',
      defaultPath: suggestedBackupName(new Date()),
      filters: [{ name: 'TotoNote backup', extensions: ['totonote'] }],
    });
    if (canceled || !filePath) return null;
    // An existing file at the destination would be backed up *into*, not replaced.
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
    return writeBackup(getSqlite(), filePath);
  });

  ipcMain.handle('backup:restore', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const { canceled, filePaths } = await dialog.showOpenDialog(window!, {
      title: 'Restore everything from a backup',
      properties: ['openFile'],
      filters: [{ name: 'TotoNote backup', extensions: ['totonote', 'db'] }],
    });
    if (canceled || filePaths.length === 0) return null;

    const check = inspectBackup(filePaths[0], getMigrationsFolder());
    if (!check.ok) return { ok: false, reason: check.reason };

    // Last chance to stop: this discards whatever is open right now.
    const { response } = await dialog.showMessageBox(window!, {
      type: 'warning',
      buttons: ['Cancel', 'Replace everything'],
      defaultId: 0,
      cancelId: 0,
      message: 'Replace everything with this backup?',
      detail:
        `The backup holds ${check.summary!.documents} document(s), ` +
        `${check.summary!.sections} section(s) and ${check.summary!.annotations} highlight(s).\n\n` +
        'Everything currently in TotoNote is replaced. The app restarts afterwards.',
    });
    if (response !== 1) return null;

    const dbPath = getDbPath();
    closeDb();
    try {
      const { keptAt } = replaceDatabase(dbPath, filePaths[0]);
      // Nothing may touch the swapped-in file through a stale handle, so start over.
      app.relaunch();
      app.exit(0);
      return { ok: true, keptAt };
    } catch (err) {
      // The swap failed, so the original file is still there — reopen it rather than
      // leaving the app running with no database at all.
      initDb();
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  });

  // App / Updates
  // Undo
  ipcMain.handle('undo:restore', (_, args: { snapshot: Parameters<typeof undoRepo.restoreSnapshot>[0] }) =>
    undoRepo.restoreSnapshot(args.snapshot)
  );

  ipcMain.handle('app:check-for-updates', () => checkForUpdates());
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:open-external', (_, args: { url: string }) => {
    if (!args.url.startsWith(ALLOWED_EXTERNAL_PREFIX)) {
      throw new Error('External URL not allowed');
    }
    return shell.openExternal(args.url);
  });
}
