import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import {
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  batchUpdatePositions,
  listPlacements,
  reorderPlacements,
  listFilingEdges,
} from './annotation-repo';

let sqliteHandle: ReturnType<typeof createTestDb>['sqlite'];

function initTestDb() {
  const { db, sqlite } = createTestDb();
  testDb = db;
  sqliteHandle = sqlite;
  sqlite.exec(`
    INSERT INTO documents (id, workspace_id, title) VALUES ('doc-1', 'ws-default', 'Test Doc');
    INSERT INTO sections (id, document_id, title, abbreviation, sort_order) VALUES ('sec-1', 'doc-1', 'Section 1', 'S1', 0);
    INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('cat-1', 'ws-default', 'Member', 1);
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

describe('filing', () => {
  beforeEach(() => {
    initTestDb();
  });

  /** TipTap JSON for one paragraph; text occupies positions 1..len+1. */
  const contentOf = (text: string) =>
    JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

  function seedFilingWorld() {
    const sqlite = sqliteHandle;
    sqlite.exec(`
      INSERT INTO categories (id, workspace_id, name, sort_order, parent_id) VALUES ('cat-gura', 'ws-default', 'GURA', 2, 'cat-1');
      INSERT INTO categories (id, workspace_id, name, sort_order, parent_id) VALUES ('cat-hist', 'ws-default', 'HISTORY', 3, 'cat-gura');
      INSERT INTO categories (id, workspace_id, name, sort_order, parent_id) VALUES ('cat-abil', 'ws-default', 'ABILITIES', 4, 'cat-gura');
      INSERT INTO documents (id, workspace_id, title) VALUES ('doc-2', 'ws-default', 'Other Doc');
      INSERT INTO sections (id, document_id, title, abbreviation, sort_order)
        VALUES ('sec-2', 'doc-2', 'Elsewhere', 'EL', 0);
    `);
    sqlite
      .prepare(`UPDATE sections SET content = ? WHERE id = 'sec-1'`)
      .run(contentOf('Gura was born in Atlantis.'));
    sqlite
      .prepare(`UPDATE sections SET content = ? WHERE id = 'sec-2'`)
      .run(contentOf('She can breathe underwater.'));
  }

  it('files a new annotation and appends to the category order', () => {
    const a = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 5, categoryId: 'cat-1' });
    const b = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 6, toPos: 9, categoryId: 'cat-1' });
    expect(a.categoryId).toBe('cat-1');
    expect(a.placementOrder).toBe(0);
    expect(b.placementOrder).toBe(1);
  });

  it('leaves plain highlights unfiled', () => {
    const a = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 5 });
    expect(a.categoryId).toBeNull();
  });

  it('refiles to the end of the new category and unfiles with null', () => {
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 3, categoryId: 'cat-1' });
    const b = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 4, toPos: 6 });

    const filed = updateAnnotation({ id: b.id, categoryId: 'cat-1' });
    expect(filed.placementOrder).toBe(1);

    const unfiled = updateAnnotation({ id: b.id, categoryId: null });
    expect(unfiled.categoryId).toBeNull();
  });

  it('keeps the filing when other fields are updated', () => {
    const a = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 3, categoryId: 'cat-1' });
    const updated = updateAnnotation({ id: a.id, note: 'hello' });
    expect(updated.categoryId).toBe('cat-1');
    expect(updated.placementOrder).toBe(a.placementOrder);
  });

  it('lists placements for a category with computed excerpts, across documents', () => {
    seedFilingWorld();

    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 5, categoryId: 'cat-hist' });
    createAnnotation({ sectionId: 'sec-2', tagId: 'tag-1', fromPos: 1, toPos: 27, categoryId: 'cat-hist' });

    const rows = listPlacements({ categoryIds: ['cat-hist'] });
    expect(rows.length).toBe(2);
    expect(rows[0].excerpt).toBe('Gura');
    expect(rows[0].documentTitle).toBe('Test Doc');
    expect(rows[1].excerpt).toBe('She can breathe underwater');
    expect(rows[1].documentTitle).toBe('Other Doc');
    expect(rows[0].tagName).toBe('Gura');
  });

  it('lists placements by tag, including unfiled annotations', () => {
    seedFilingWorld();
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 5, categoryId: 'cat-hist' });
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 6, toPos: 9 });
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-2', fromPos: 10, toPos: 14 });

    const rows = listPlacements({ tagId: 'tag-1' });
    expect(rows.length).toBe(2);
    expect(rows.map(r => r.categoryId).sort()).toEqual([null, 'cat-hist'].sort());
  });

  it('respects manual reordering', () => {
    seedFilingWorld();
    const a = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 5, categoryId: 'cat-hist' });
    const b = createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 6, toPos: 9, categoryId: 'cat-hist' });

    reorderPlacements('cat-hist', [b.id, a.id]);

    const rows = listPlacements({ categoryIds: ['cat-hist'] });
    expect(rows.map(r => r.id)).toEqual([b.id, a.id]);
  });

  it('aggregates filing edges for the graph', () => {
    seedFilingWorld();
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 1, toPos: 5, categoryId: 'cat-hist' });
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-1', fromPos: 6, toPos: 9, categoryId: 'cat-hist' });
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-2', fromPos: 10, toPos: 14, categoryId: 'cat-abil' });
    createAnnotation({ sectionId: 'sec-1', tagId: 'tag-2', fromPos: 15, toPos: 18 }); // unfiled

    const edges = listFilingEdges();
    expect(edges.length).toBe(2);
    const hist = edges.find(e => e.categoryId === 'cat-hist');
    expect(hist).toMatchObject({ tagId: 'tag-1', count: 2 });
  });
});
