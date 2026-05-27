import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { getPreference, setPreference, listDocumentTags, addDocumentTag, removeDocumentTag } from './preference-repo';

function initTestDb() {
  testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(`
    CREATE TABLE preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      section_label TEXT DEFAULT 'Section',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#48dbfb',
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE document_tags (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id),
      PRIMARY KEY (document_id, tag_id)
    );

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
