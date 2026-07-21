import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { restoreSnapshot } from './undo-repo';
import { deleteTag } from './tag-repo';
import { deleteCategory, createCategory, listCategories } from './category-repo';
import { deleteDocument } from './document-repo';
import { deleteSection } from './section-repo';
import { setCategoryRule, getCategoryRule } from './category-rule-repo';
import { createAnnotation, listAnnotations } from './annotation-repo';

let sqlite: ReturnType<typeof createTestDb>['sqlite'];

const count = (table: string) =>
  (sqlite.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

function initTestDb() {
  const handle = createTestDb();
  testDb = handle.db;
  sqlite = handle.sqlite;
  sqlite.exec(`
    INSERT INTO documents (id, workspace_id, title) VALUES ('doc-1', 'ws-default', 'Lore');
    INSERT INTO sections (id, document_id, title, abbreviation, sort_order)
      VALUES ('sec-1', 'doc-1', 'Intro', 'IN', 0);
    INSERT INTO sections (id, document_id, title, abbreviation, sort_order)
      VALUES ('sec-2', 'doc-1', 'Later', 'LA', 1);
    INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('cat-1', 'ws-default', 'CHARACTERS', 1);
    INSERT INTO tags (id, category_id, name, color) VALUES ('tag-1', 'cat-1', 'Gura', '#ff0000');
    INSERT INTO annotations (id, section_id, tag_id, from_pos, to_pos)
      VALUES ('ann-1', 'sec-1', 'tag-1', 1, 5);
    INSERT INTO annotations (id, section_id, tag_id, from_pos, to_pos)
      VALUES ('ann-2', 'sec-2', 'tag-1', 1, 5);
    INSERT INTO section_tags (section_id, tag_id) VALUES ('sec-1', 'tag-1');
    INSERT INTO document_tags (document_id, tag_id, category_id) VALUES ('doc-1', 'tag-1', 'cat-1');
  `);
}

describe('undo-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('deleting a tag', () => {
    it('takes its annotations and links with it, and puts them all back', () => {
      const snapshot = deleteTag('tag-1');
      expect(count('tags')).toBe(0);
      expect(count('annotations')).toBe(0);
      expect(count('section_tags')).toBe(0);
      expect(count('document_tags')).toBe(0);

      restoreSnapshot(snapshot);

      expect(count('tags')).toBe(1);
      expect(count('annotations')).toBe(2);
      expect(count('section_tags')).toBe(1);
      expect(count('document_tags')).toBe(1);
    });

    it('restores the tag exactly as it was', () => {
      const snapshot = deleteTag('tag-1');
      restoreSnapshot(snapshot);
      const tag = sqlite.prepare(`SELECT * FROM tags WHERE id = 'tag-1'`).get() as Record<string, unknown>;
      expect(tag.name).toBe('Gura');
      expect(tag.color).toBe('#ff0000');
      expect(tag.category_id).toBe('cat-1');
    });

    it('labels the snapshot with the tag name', () => {
      expect(deleteTag('tag-1')).toMatchObject({ kind: 'tag', label: 'Gura' });
    });
  });

  describe('deleting a section', () => {
    it('restores the section and the annotations inside it', () => {
      const snapshot = deleteSection('sec-1');
      expect(count('sections')).toBe(1);
      expect(count('annotations')).toBe(1); // sec-2's survived

      restoreSnapshot(snapshot);

      expect(count('sections')).toBe(2);
      expect(count('annotations')).toBe(2);
      expect(listAnnotations('sec-1').length).toBe(1);
    });
  });

  describe('deleting a document', () => {
    it('restores the document, its sections and everything in them', () => {
      const snapshot = deleteDocument('doc-1');
      expect(count('documents')).toBe(0);
      expect(count('sections')).toBe(0);
      expect(count('annotations')).toBe(0);

      restoreSnapshot(snapshot);

      expect(count('documents')).toBe(1);
      expect(count('sections')).toBe(2);
      expect(count('annotations')).toBe(2);
      expect(count('document_tags')).toBe(1);
    });
  });

  describe('deleting a category', () => {
    it('restores the whole subtree, its tags, rules and highlights', () => {
      const gura = createCategory({ name: 'GURA', parentId: 'cat-1' }).category;
      setCategoryRule('cat-1', 'HISTORY\nABILITIES');
      sqlite
        .prepare(`INSERT INTO tags (id, category_id, name) VALUES ('tag-2', ?, 'Trident')`)
        .run(gura.id);

      const { snapshot } = deleteCategory('cat-1');
      expect(count('categories')).toBe(0);
      expect(count('tags')).toBe(0);
      expect(count('annotations')).toBe(0);
      expect(count('category_rules')).toBe(0);

      restoreSnapshot(snapshot);

      expect(listCategories().map(c => c.name).sort()).toEqual(['CHARACTERS', 'GURA']);
      expect(count('tags')).toBe(2);
      expect(count('annotations')).toBe(2);
      expect(getCategoryRule('cat-1')?.template).toBe('HISTORY\nABILITIES');
      // The child still points at its parent.
      expect(listCategories().find(c => c.name === 'GURA')?.parentId).toBe('cat-1');
    });

    it('re-files annotations that were only unfiled by the delete', () => {
      // Filed annotations survive a category delete (ON DELETE SET NULL) but lose their
      // filing — undo has to put the filing back without duplicating the row.
      const hist = createCategory({ name: 'HISTORY', parentId: 'cat-1' }).category;
      const filed = createAnnotation({
        sectionId: 'sec-1',
        tagId: 'tag-1',
        fromPos: 10,
        toPos: 14,
        categoryId: hist.id,
      });

      const { snapshot } = deleteCategory(hist.id);
      const after = sqlite
        .prepare(`SELECT category_id FROM annotations WHERE id = ?`)
        .get(filed.id) as { category_id: string | null };
      expect(after.category_id).toBeNull();
      const annotationCount = count('annotations');

      restoreSnapshot(snapshot);

      const restored = sqlite
        .prepare(`SELECT category_id FROM annotations WHERE id = ?`)
        .get(filed.id) as { category_id: string | null };
      expect(restored.category_id).toBe(hist.id);
      // Restored by update, not by inserting a duplicate.
      expect(count('annotations')).toBe(annotationCount);
    });
  });

  describe('restoreSnapshot', () => {
    it('is safe to run twice', () => {
      const snapshot = deleteTag('tag-1');
      restoreSnapshot(snapshot);
      expect(() => restoreSnapshot(snapshot)).not.toThrow();
      expect(count('tags')).toBe(1);
      expect(count('annotations')).toBe(2);
    });

    it('leaves the database consistent', () => {
      const snapshot = deleteDocument('doc-1');
      restoreSnapshot(snapshot);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    });

    it('does nothing for an empty snapshot', () => {
      const snapshot = deleteTag('nope');
      expect(() => restoreSnapshot(snapshot)).not.toThrow();
      expect(count('tags')).toBe(1);
    });
  });
});
