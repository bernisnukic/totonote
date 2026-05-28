import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { getPreference, setPreference, listDocumentTags, addDocumentTag, removeDocumentTag } from './preference-repo';

function initTestDb() {
  const { db, sqlite } = createTestDb();
  testDb = db;
  sqlite.exec(`
    INSERT INTO documents (id, title) VALUES ('doc-1', 'Test Doc');
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-1', 'Member', 1);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-2', 'Location', 2);
    INSERT INTO tags (id, category_id, name, color) VALUES ('tag-1', 'cat-1', 'Gura', '#ff0000');
    INSERT INTO tags (id, category_id, name, color) VALUES ('tag-2', 'cat-2', 'Tokyo', '#00ff00');
  `);
}

describe('preference-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('getPreference', () => {
    it('returns null for nonexistent key', () => {
      expect(getPreference('nonexistent')).toBeNull();
    });

    it('returns the value for an existing key', () => {
      setPreference('theme', '"dark"');
      expect(getPreference('theme')).toBe('"dark"');
    });
  });

  describe('setPreference', () => {
    it('sets a new preference', () => {
      setPreference('fontSize', '14');
      expect(getPreference('fontSize')).toBe('14');
    });

    it('upserts on conflict (updates existing)', () => {
      setPreference('theme', '"dark"');
      setPreference('theme', '"light"');
      expect(getPreference('theme')).toBe('"light"');
    });

    it('stores JSON values', () => {
      const shortcuts = JSON.stringify({ save: 'Ctrl+S', undo: 'Ctrl+Z' });
      setPreference('shortcuts', shortcuts);
      const result = getPreference('shortcuts');
      expect(JSON.parse(result!)).toEqual({ save: 'Ctrl+S', undo: 'Ctrl+Z' });
    });
  });
});

describe('document-tags', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('addDocumentTag', () => {
    it('adds a tag to a document', () => {
      addDocumentTag('doc-1', 'tag-1', 'cat-1');
      const tags = listDocumentTags('doc-1');
      expect(tags.length).toBe(1);
      expect(tags[0].tagId).toBe('tag-1');
      expect(tags[0].tagName).toBe('Gura');
      expect(tags[0].tagColor).toBe('#ff0000');
      expect(tags[0].categoryName).toBe('Member');
    });

    it('ignores duplicate additions', () => {
      addDocumentTag('doc-1', 'tag-1', 'cat-1');
      addDocumentTag('doc-1', 'tag-1', 'cat-1');
      const tags = listDocumentTags('doc-1');
      expect(tags.length).toBe(1);
    });
  });

  describe('listDocumentTags', () => {
    it('returns tags ordered by category sort_order then tag name', () => {
      addDocumentTag('doc-1', 'tag-2', 'cat-2');
      addDocumentTag('doc-1', 'tag-1', 'cat-1');
      const tags = listDocumentTags('doc-1');
      expect(tags.length).toBe(2);
      // cat-1 (Member, sort_order=1) should come before cat-2 (Location, sort_order=2)
      expect(tags[0].categoryName).toBe('Member');
      expect(tags[1].categoryName).toBe('Location');
    });

    it('returns empty for unknown document', () => {
      expect(listDocumentTags('unknown')).toEqual([]);
    });
  });

  describe('removeDocumentTag', () => {
    it('removes a tag from a document', () => {
      addDocumentTag('doc-1', 'tag-1', 'cat-1');
      removeDocumentTag('doc-1', 'tag-1');
      expect(listDocumentTags('doc-1')).toEqual([]);
    });

    it('does not throw for nonexistent association', () => {
      expect(() => removeDocumentTag('doc-1', 'tag-1')).not.toThrow();
    });
  });
});
