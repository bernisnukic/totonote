import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation, batchUpdatePositions } from './annotation-repo';

function initTestDb() {
  const { db, sqlite } = createTestDb();
  testDb = db;
  sqlite.exec(`
    INSERT INTO documents (id, title) VALUES ('doc-1', 'Test Doc');
    INSERT INTO sections (id, document_id, title, abbreviation, sort_order) VALUES ('sec-1', 'doc-1', 'Section 1', 'S1', 0);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-1', 'Member', 1);
    INSERT INTO tags (id, category_id, name) VALUES ('tag-1', 'cat-1', 'Gura');
    INSERT INTO tags (id, category_id, name) VALUES ('tag-2', 'cat-1', 'Ame');
  `);
}

describe('annotation-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('createAnnotation', () => {
    it('creates an annotation', () => {
      const ann = createAnnotation({
        sectionId: 'sec-1',
        tagId: 'tag-1',
        fromPos: 0,
        toPos: 10,
      });
      expect(ann.sectionId).toBe('sec-1');
      expect(ann.tagId).toBe('tag-1');
      expect(ann.fromPos).toBe(0);
      expect(ann.toPos).toBe(10);
      expect(ann.note).toBe('');
      expect(ann.id).toBeTruthy();
    });

    it('creates with a note', () => {
      const ann = createAnnotation({
        sectionId: 'sec-1',
        tagId: 'tag-1',
        fromPos: 5,
        toPos: 15,
        note: 'Important reference',
      });
      expect(ann.note).toBe('Important reference');
    });
  });

  describe('listAnnotations', () => {
    it('returns annotations ordered by from_pos', () => {
      createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 20, toPos: 30 });
      createAnnotation({ sectionId: 'sec-1', tagId: 'tag-2', fromPos: 5, toPos: 10 });
      const anns = listAnnotations('sec-1');
      expect(anns.length).toBe(2);
      expect(anns[0].fromPos).toBe(5);
      expect(anns[1].fromPos).toBe(20);
    });

    it('returns empty for unknown section', () => {
      expect(listAnnotations('unknown')).toEqual([]);
    });
  });

  describe('updateAnnotation', () => {
    it('updates positions', () => {
      const ann = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 0, toPos: 10 });
      const updated = updateAnnotation({ id: ann.id, fromPos: 5, toPos: 15 });
      expect(updated.fromPos).toBe(5);
      expect(updated.toPos).toBe(15);
    });

    it('updates note', () => {
      const ann = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 0, toPos: 10 });
      const updated = updateAnnotation({ id: ann.id, note: 'New note' });
      expect(updated.note).toBe('New note');
    });

    it('updates tagId', () => {
      const ann = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 0, toPos: 10 });
      const updated = updateAnnotation({ id: ann.id, tagId: 'tag-2' });
      expect(updated.tagId).toBe('tag-2');
    });

    it('preserves unchanged fields', () => {
      const ann = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 0, toPos: 10, note: 'Keep me' });
      const updated = updateAnnotation({ id: ann.id, fromPos: 5 });
      expect(updated.note).toBe('Keep me');
      expect(updated.toPos).toBe(10);
      expect(updated.tagId).toBe('tag-1');
    });

    it('throws for nonexistent annotation', () => {
      expect(() => updateAnnotation({ id: 'fake', note: 'X' })).toThrow('Annotation not found');
    });
  });

  describe('deleteAnnotation', () => {
    it('deletes an annotation', () => {
      const ann = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 0, toPos: 10 });
      deleteAnnotation(ann.id);
      expect(listAnnotations('sec-1')).toEqual([]);
    });
  });

  describe('batchUpdatePositions', () => {
    it('updates multiple annotation positions in a transaction', () => {
      const a1 = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 0, toPos: 10 });
      const a2 = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-2', fromPos: 20, toPos: 30 });

      batchUpdatePositions([
        { id: a1.id, fromPos: 5, toPos: 15 },
        { id: a2.id, fromPos: 25, toPos: 35 },
      ]);

      const anns = listAnnotations('sec-1');
      const updated1 = anns.find(a => a.id === a1.id)!;
      const updated2 = anns.find(a => a.id === a2.id)!;
      expect(updated1.fromPos).toBe(5);
      expect(updated1.toPos).toBe(15);
      expect(updated2.fromPos).toBe(25);
      expect(updated2.toPos).toBe(35);
    });

    it('handles empty array', () => {
      expect(() => batchUpdatePositions([])).not.toThrow();
    });
  });
});
