import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { listTags, createTag, updateTag, deleteTag, searchTags } from './tag-repo';

function initTestDb() {
  testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(`
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
    CREATE INDEX idx_tags_category ON tags(category_id);
    CREATE UNIQUE INDEX idx_tags_name_category ON tags(name, category_id);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-1', 'Member', 1);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-2', 'Location', 2);
  `);
}

describe('tag-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('createTag', () => {
    it('creates a tag with defaults', () => {
      const tag = createTag({ categoryId: 'cat-1', name: 'Gura' });
      expect(tag.name).toBe('Gura');
      expect(tag.categoryId).toBe('cat-1');
      expect(tag.color).toBe('#48dbfb');
      expect(tag.description).toBe('');
      expect(tag.id).toBeTruthy();
    });

    it('creates a tag with custom color and description', () => {
      const tag = createTag({
        categoryId: 'cat-1',
        name: 'Ame',
        color: '#ff0000',
        description: 'Detective',
      });
      expect(tag.color).toBe('#ff0000');
      expect(tag.description).toBe('Detective');
    });
  });

  describe('listTags', () => {
    it('returns all tags when no categoryId', () => {
      createTag({ categoryId: 'cat-1', name: 'A' });
      createTag({ categoryId: 'cat-2', name: 'B' });
      const tags = listTags();
      expect(tags.length).toBe(2);
    });

    it('filters by categoryId', () => {
      createTag({ categoryId: 'cat-1', name: 'A' });
      createTag({ categoryId: 'cat-2', name: 'B' });
      const tags = listTags('cat-1');
      expect(tags.length).toBe(1);
      expect(tags[0].name).toBe('A');
    });

    it('returns tags ordered by name', () => {
      createTag({ categoryId: 'cat-1', name: 'Zeta' });
      createTag({ categoryId: 'cat-1', name: 'Alpha' });
      const tags = listTags('cat-1');
      expect(tags[0].name).toBe('Alpha');
      expect(tags[1].name).toBe('Zeta');
    });

    it('returns empty for unknown category', () => {
      expect(listTags('unknown')).toEqual([]);
    });
  });

  describe('updateTag', () => {
    it('updates name', () => {
      const tag = createTag({ categoryId: 'cat-1', name: 'Old' });
      const updated = updateTag({ id: tag.id, name: 'New' });
      expect(updated.name).toBe('New');
      expect(updated.color).toBe('#48dbfb');
    });

    it('updates color and description', () => {
      const tag = createTag({ categoryId: 'cat-1', name: 'T' });
      const updated = updateTag({ id: tag.id, color: '#00ff00', description: 'Updated' });
      expect(updated.color).toBe('#00ff00');
      expect(updated.description).toBe('Updated');
    });

    it('updates categoryId', () => {
      const tag = createTag({ categoryId: 'cat-1', name: 'T' });
      const updated = updateTag({ id: tag.id, categoryId: 'cat-2' });
      expect(updated.categoryId).toBe('cat-2');
    });

    it('throws for nonexistent tag', () => {
      expect(() => updateTag({ id: 'fake', name: 'X' })).toThrow('Tag not found');
    });
  });

  describe('deleteTag', () => {
    it('deletes a tag', () => {
      const tag = createTag({ categoryId: 'cat-1', name: 'Del' });
      deleteTag(tag.id);
      const tags = listTags();
      expect(tags.length).toBe(0);
    });
  });

  describe('searchTags', () => {
    it('finds tags by partial name', () => {
      createTag({ categoryId: 'cat-1', name: 'Gura' });
      createTag({ categoryId: 'cat-1', name: 'Gawr' });
      createTag({ categoryId: 'cat-2', name: 'Tokyo' });
      const results = searchTags('G');
      expect(results.length).toBe(2);
    });

    it('is case-insensitive (LIKE default behavior)', () => {
      createTag({ categoryId: 'cat-1', name: 'Gura' });
      const results = searchTags('gura');
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', () => {
      createTag({ categoryId: 'cat-1', name: 'Gura' });
      expect(searchTags('zzz')).toEqual([]);
    });
  });
});
