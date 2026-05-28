import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { listSections, getSection, createSection, updateSection, deleteSection, reorderSections } from './section-repo';

function initTestDb() {
  const { db, sqlite } = createTestDb();
  testDb = db;
  sqlite.exec(`INSERT INTO documents (id, title) VALUES ('doc-1', 'Test Doc');`);
}

describe('section-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('createSection', () => {
    it('creates a section', () => {
      const sec = createSection({
        documentId: 'doc-1',
        title: 'Ancient Age',
        abbreviation: 'ANC',
        sortOrder: 0,
      });
      expect(sec.title).toBe('Ancient Age');
      expect(sec.abbreviation).toBe('ANC');
      expect(sec.sortOrder).toBe(0);
      expect(sec.documentId).toBe('doc-1');
    });

    it('creates with content', () => {
      const sec = createSection({
        documentId: 'doc-1',
        title: 'Test',
        abbreviation: 'TST',
        sortOrder: 0,
        content: '{"type":"doc"}',
      });
      expect(sec.content).toBe('{"type":"doc"}');
    });
  });

  describe('listSections', () => {
    it('returns sections ordered by sort_order', () => {
      createSection({ documentId: 'doc-1', title: 'B', abbreviation: 'B', sortOrder: 1 });
      createSection({ documentId: 'doc-1', title: 'A', abbreviation: 'A', sortOrder: 0 });
      const sections = listSections('doc-1');
      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('A');
      expect(sections[1].title).toBe('B');
    });

    it('returns empty for unknown document', () => {
      expect(listSections('unknown')).toEqual([]);
    });
  });

  describe('updateSection', () => {
    it('updates title and abbreviation', () => {
      const sec = createSection({ documentId: 'doc-1', title: 'Old', abbreviation: 'OLD', sortOrder: 0 });
      const updated = updateSection({ id: sec.id, title: 'New', abbreviation: 'NEW' });
      expect(updated.title).toBe('New');
      expect(updated.abbreviation).toBe('NEW');
    });

    it('updates content', () => {
      const sec = createSection({ documentId: 'doc-1', title: 'T', abbreviation: 'T', sortOrder: 0 });
      const updated = updateSection({ id: sec.id, content: '{"new":"content"}' });
      expect(updated.content).toBe('{"new":"content"}');
    });

    it('throws for nonexistent section', () => {
      expect(() => updateSection({ id: 'fake', title: 'X' })).toThrow('Section not found');
    });
  });

  describe('deleteSection', () => {
    it('deletes a section', () => {
      const sec = createSection({ documentId: 'doc-1', title: 'Del', abbreviation: 'D', sortOrder: 0 });
      deleteSection(sec.id);
      expect(getSection(sec.id)).toBeNull();
    });
  });

  describe('reorderSections', () => {
    it('reorders sections by given id list', () => {
      const a = createSection({ documentId: 'doc-1', title: 'A', abbreviation: 'A', sortOrder: 0 });
      const b = createSection({ documentId: 'doc-1', title: 'B', abbreviation: 'B', sortOrder: 1 });
      const c = createSection({ documentId: 'doc-1', title: 'C', abbreviation: 'C', sortOrder: 2 });

      reorderSections('doc-1', [c.id, a.id, b.id]);

      const sections = listSections('doc-1');
      expect(sections[0].id).toBe(c.id);
      expect(sections[1].id).toBe(a.id);
      expect(sections[2].id).toBe(b.id);
    });
  });
});
