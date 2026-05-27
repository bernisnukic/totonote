import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { listCategories, listBrowseCategories } from './category-repo';

function initTestDb() {
  testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE browse_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES browse_categories(id),
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    INSERT INTO categories (id, name, sort_order) VALUES ('cat-1', 'Member', 1);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-2', 'Location', 2);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-3', 'Game', 3);

    INSERT INTO browse_categories (id, name, sort_order) VALUES ('bc-gen', 'Gen', 1);
    INSERT INTO browse_categories (id, name, sort_order) VALUES ('bc-group', 'Group', 2);
    INSERT INTO browse_categories (id, name, parent_id, sort_order) VALUES ('bc-sub', 'Sub Group', 'bc-group', 3);
  `);
}

describe('category-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('listCategories', () => {
    it('returns categories ordered by sort_order', () => {
      const cats = listCategories();
      expect(cats.length).toBe(3);
      expect(cats[0].name).toBe('Member');
      expect(cats[1].name).toBe('Location');
      expect(cats[2].name).toBe('Game');
    });

    it('maps row fields correctly', () => {
      const cats = listCategories();
      expect(cats[0]).toEqual({
        id: 'cat-1',
        name: 'Member',
        parentId: null,
        sortOrder: 1,
      });
    });
  });

  describe('listBrowseCategories', () => {
    it('returns browse categories ordered by sort_order', () => {
      const cats = listBrowseCategories();
      expect(cats.length).toBe(3);
      expect(cats[0].name).toBe('Gen');
      expect(cats[1].name).toBe('Group');
      expect(cats[2].name).toBe('Sub Group');
    });

    it('includes parent_id mapping', () => {
      const cats = listBrowseCategories();
      expect(cats[0].parentId).toBeNull();
      expect(cats[2].parentId).toBe('bc-group');
    });
  });
});
