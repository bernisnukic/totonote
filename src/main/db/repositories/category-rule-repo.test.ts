import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import {
  listCategoryRules,
  getCategoryRule,
  setCategoryRule,
  deleteCategoryRule,
} from './category-rule-repo';

function initTestDb() {
  const { db, sqlite } = createTestDb();
  testDb = db;
  sqlite.exec(`
    INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('cat-1', 'ws-default', 'CHARACTERS', 1);
    INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('cat-2', 'ws-default', 'LOCATIONS', 2);
  `);
}

const RULE = 'HISTORY\nABILITIES\nCOLOUR PALETTE';

describe('category-rule-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('setCategoryRule', () => {
    it('stores a rule and returns it', () => {
      const rule = setCategoryRule('cat-1', RULE);
      expect(rule).toMatchObject({ categoryId: 'cat-1', template: RULE });
      expect(rule!.updatedAt).toBeTruthy();
    });

    it('preserves the template verbatim, indentation included', () => {
      const indented = 'HISTORY\nABILITIES\n  COMBAT\n\tMAGIC';
      setCategoryRule('cat-1', indented);
      expect(getCategoryRule('cat-1')!.template).toBe(indented);
    });

    it('overwrites an existing rule rather than inserting a second', () => {
      setCategoryRule('cat-1', RULE);
      setCategoryRule('cat-1', 'ONLY THIS');
      expect(getCategoryRule('cat-1')!.template).toBe('ONLY THIS');
      expect(listCategoryRules().length).toBe(1);
    });

    it('deletes the rule when the template has no usable names', () => {
      setCategoryRule('cat-1', RULE);
      expect(setCategoryRule('cat-1', '  \n\t\n')).toBeNull();
      expect(getCategoryRule('cat-1')).toBeNull();
    });

    it('stores nothing when a blank template is set on a category with no rule', () => {
      expect(setCategoryRule('cat-1', '')).toBeNull();
      expect(listCategoryRules()).toEqual([]);
    });
  });

  describe('getCategoryRule', () => {
    it('returns null for a category with no rule', () => {
      expect(getCategoryRule('cat-2')).toBeNull();
    });

    it('returns null for an unknown category', () => {
      expect(getCategoryRule('nope')).toBeNull();
    });
  });

  describe('listCategoryRules', () => {
    it('returns every stored rule', () => {
      setCategoryRule('cat-1', RULE);
      setCategoryRule('cat-2', 'MAP\nCLIMATE');
      expect(listCategoryRules().map(r => r.categoryId).sort()).toEqual(['cat-1', 'cat-2']);
    });

    it('is empty when nothing is stored', () => {
      expect(listCategoryRules()).toEqual([]);
    });
  });

  describe('deleteCategoryRule', () => {
    it('removes only the named rule', () => {
      setCategoryRule('cat-1', RULE);
      setCategoryRule('cat-2', 'MAP');
      deleteCategoryRule('cat-1');
      expect(getCategoryRule('cat-1')).toBeNull();
      expect(getCategoryRule('cat-2')).not.toBeNull();
    });

    it('is a no-op for a category with no rule', () => {
      expect(() => deleteCategoryRule('cat-2')).not.toThrow();
    });
  });
});
