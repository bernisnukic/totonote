import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  collectCategoryIds,
  applyRuleToExistingChildren,
  bulkAddSubcategory,
  listBrowseCategories,
} from './category-repo';
import { setCategoryRule } from './category-rule-repo';

let sqliteHandle: ReturnType<typeof createTestDb>['sqlite'];

function initTestDb() {
  const { db, sqlite } = createTestDb();
  testDb = db;
  sqliteHandle = sqlite;
  sqlite.exec(`
    INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('cat-1', 'ws-default', 'Member', 1);
    INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('cat-2', 'ws-default', 'Location', 2);
    INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('cat-3', 'ws-default', 'Game', 3);
    INSERT INTO browse_categories (id, name, sort_order) VALUES ('bc-gen', 'Gen', 1);
    INSERT INTO browse_categories (id, name, sort_order) VALUES ('bc-group', 'Group', 2);
    INSERT INTO browse_categories (id, name, parent_id, sort_order) VALUES ('bc-sub', 'Sub Group', 'bc-group', 3);
  `);
}

/** Names of the direct children of a category, in sort order. */
function childNames(parentId: string): string[] {
  return listCategories()
    .filter(c => c.parentId === parentId)
    .map(c => c.name);
}

function findByName(name: string, parentId?: string) {
  return listCategories().find(c => c.name === name && (parentId === undefined || c.parentId === parentId));
}

const CHARACTER_RULE = 'HISTORY\nABILITIES\nCOLOUR PALETTE';

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
        workspaceId: 'ws-default',
        name: 'Member',
        parentId: null,
        sortOrder: 1,
      });
    });
  });

  describe('createCategory', () => {
    it('creates a root category', () => {
      const { category, descendants } = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' });
      expect(category.parentId).toBeNull();
      expect(category.name).toBe('CHARACTERS');
      expect(descendants).toEqual([]);
    });

    it('creates a sub-category under a parent', () => {
      const parent = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const { category } = createCategory({ name: 'GURA', parentId: parent.id });
      expect(category.parentId).toBe(parent.id);
    });

    it('trims the name and rejects a blank one', () => {
      expect(createCategory({ workspaceId: 'ws-default', name: '  SPACED  ' }).category.name).toBe('SPACED');
      expect(() => createCategory({ workspaceId: 'ws-default', name: '   ' })).toThrow(/name is required/i);
    });

    it('rejects a duplicate sibling with a readable message', () => {
      const parent = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      createCategory({ name: 'GURA', parentId: parent.id });
      expect(() => createCategory({ name: 'gura', parentId: parent.id })).toThrow(
        /sub-category named "GURA" already exists/i,
      );
      expect(() => createCategory({ workspaceId: 'ws-default', name: 'characters' })).toThrow(/category named "CHARACTERS" already exists/i);
    });

    it('rejects an unknown parent', () => {
      expect(() => createCategory({ name: 'X', parentId: 'nope' })).toThrow(/Parent category not found/);
    });
  });

  describe('createCategory with a rule', () => {
    it('stamps the parent rule onto a new sub-category', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      setCategoryRule(chars.id, CHARACTER_RULE);

      const { category: gura, descendants } = createCategory({
        name: 'GURA',
        parentId: chars.id,
        applyRule: true,
      });

      expect(childNames(gura.id)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
      expect(descendants.map(d => d.name)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
    });

    it('does not apply the rule when the checkbox is off', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      setCategoryRule(chars.id, CHARACTER_RULE);

      const { category: gura, descendants } = createCategory({ name: 'GURA', parentId: chars.id });

      expect(childNames(gura.id)).toEqual([]);
      expect(descendants).toEqual([]);
    });

    it('is a no-op when the parent has no rule', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const { descendants } = createCategory({ name: 'GURA', parentId: chars.id, applyRule: true });
      expect(descendants).toEqual([]);
    });

    it('allows the same sub-category names under different siblings', () => {
      // The whole point of the feature — and impossible before the unique index moved
      // from `name` to `(parent_id, name)`.
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      setCategoryRule(chars.id, CHARACTER_RULE);

      const gura = createCategory({ name: 'GURA', parentId: chars.id, applyRule: true }).category;
      const pekora = createCategory({ name: 'PEKORA', parentId: chars.id, applyRule: true }).category;

      expect(childNames(gura.id)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
      expect(childNames(pekora.id)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
      expect(listCategories().filter(c => c.name === 'HISTORY').length).toBe(2);
    });

    it('applies a nested rule to full depth', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      setCategoryRule(chars.id, 'HISTORY\nABILITIES\n  COMBAT\n  MAGIC');

      const gura = createCategory({ name: 'GURA', parentId: chars.id, applyRule: true }).category;

      const abilities = findByName('ABILITIES', gura.id)!;
      expect(childNames(gura.id)).toEqual(['HISTORY', 'ABILITIES']);
      expect(childNames(abilities.id)).toEqual(['COMBAT', 'MAGIC']);
    });

    it('only applies the immediate parent rule, not an ancestor rule', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      setCategoryRule(chars.id, CHARACTER_RULE);
      const gura = createCategory({ name: 'GURA', parentId: chars.id, applyRule: true }).category;
      const history = findByName('HISTORY', gura.id)!;

      // HISTORY has no rule of its own, so nothing is stamped.
      const { descendants } = createCategory({ name: 'EARLY LIFE', parentId: history.id, applyRule: true });
      expect(descendants).toEqual([]);
    });
  });

  describe('applyRuleToExistingChildren', () => {
    it('back-fills sub-categories created before the rule existed', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const gura = createCategory({ name: 'GURA', parentId: chars.id }).category;
      const pekora = createCategory({ name: 'PEKORA', parentId: chars.id }).category;

      setCategoryRule(chars.id, CHARACTER_RULE);
      const result = applyRuleToExistingChildren(chars.id);

      expect(result.childrenAffected).toBe(2);
      expect(result.created.length).toBe(6);
      expect(childNames(gura.id)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
      expect(childNames(pekora.id)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
    });

    it('is idempotent — a second run creates nothing', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      createCategory({ name: 'GURA', parentId: chars.id });
      setCategoryRule(chars.id, CHARACTER_RULE);

      applyRuleToExistingChildren(chars.id);
      const second = applyRuleToExistingChildren(chars.id);

      expect(second.created).toEqual([]);
      expect(second.childrenAffected).toBe(0);
      expect(listCategories().filter(c => c.name === 'HISTORY').length).toBe(1);
    });

    it('adds only the missing nodes and leaves existing ones alone', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const gura = createCategory({ name: 'GURA', parentId: chars.id }).category;
      const existingHistory = createCategory({ name: 'HISTORY', parentId: gura.id }).category;

      setCategoryRule(chars.id, CHARACTER_RULE);
      const result = applyRuleToExistingChildren(chars.id);

      expect(result.created.map(c => c.name)).toEqual(['ABILITIES', 'COLOUR PALETTE']);
      // The pre-existing node was reused, not replaced.
      expect(findByName('HISTORY', gura.id)!.id).toBe(existingHistory.id);
    });

    it('matches existing sub-categories case-insensitively', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const gura = createCategory({ name: 'GURA', parentId: chars.id }).category;
      createCategory({ name: 'History', parentId: gura.id });

      setCategoryRule(chars.id, CHARACTER_RULE);
      const result = applyRuleToExistingChildren(chars.id);

      expect(result.created.map(c => c.name)).toEqual(['ABILITIES', 'COLOUR PALETTE']);
      expect(childNames(gura.id)).toEqual(['History', 'ABILITIES', 'COLOUR PALETTE']);
    });

    it('does nothing when the category has no rule', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      createCategory({ name: 'GURA', parentId: chars.id });
      expect(applyRuleToExistingChildren(chars.id)).toEqual({ created: [], childrenAffected: 0 });
    });
  });

  describe('bulkAddSubcategory', () => {
    it('adds the same sub-category to several categories at once', () => {
      const a = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const b = createCategory({ workspaceId: 'ws-default', name: 'LOCATIONS' }).category;

      const result = bulkAddSubcategory({ parentIds: [a.id, b.id], name: 'NOTES' });

      expect(result.created.length).toBe(2);
      expect(result.skipped).toEqual([]);
      expect(childNames(a.id)).toEqual(['NOTES']);
      expect(childNames(b.id)).toEqual(['NOTES']);
    });

    it('skips categories that already have that sub-category', () => {
      const a = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const b = createCategory({ workspaceId: 'ws-default', name: 'LOCATIONS' }).category;
      createCategory({ name: 'NOTES', parentId: a.id });

      const result = bulkAddSubcategory({ parentIds: [a.id, b.id], name: 'notes' });

      expect(result.created.map(c => c.parentId)).toEqual([b.id]);
      expect(result.skipped).toEqual([{ parentId: a.id, parentName: 'CHARACTERS' }]);
      expect(childNames(a.id)).toEqual(['NOTES']);
    });

    it('applies each parent’s own rule to the new child', () => {
      const a = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const b = createCategory({ workspaceId: 'ws-default', name: 'LOCATIONS' }).category;
      setCategoryRule(a.id, CHARACTER_RULE);
      setCategoryRule(b.id, 'MAP\nCLIMATE');

      bulkAddSubcategory({ parentIds: [a.id, b.id], name: 'DRAFT', applyRule: true });

      expect(childNames(findByName('DRAFT', a.id)!.id)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
      expect(childNames(findByName('DRAFT', b.id)!.id)).toEqual(['MAP', 'CLIMATE']);
    });

    it('ignores unknown parent ids', () => {
      const a = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const result = bulkAddSubcategory({ parentIds: [a.id, 'ghost'], name: 'NOTES' });
      expect(result.created.length).toBe(1);
      expect(result.skipped).toEqual([]);
    });

    it('rejects a blank name', () => {
      expect(() => bulkAddSubcategory({ parentIds: ['cat-1'], name: '  ' })).toThrow(/name is required/i);
    });
  });

  describe('deleteCategory', () => {
    it('deletes descendants rather than promoting them to root', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      setCategoryRule(chars.id, CHARACTER_RULE);
      const gura = createCategory({ name: 'GURA', parentId: chars.id, applyRule: true }).category;

      const { removedIds: removed } = deleteCategory(chars.id);

      expect(removed).toContain(chars.id);
      expect(removed).toContain(gura.id);
      expect(removed.length).toBe(5); // CHARACTERS + GURA + 3 rule nodes
      expect(listCategories().map(c => c.id)).not.toContain(gura.id);
      // Nothing was orphaned up to the root.
      expect(listCategories().filter(c => c.name === 'HISTORY')).toEqual([]);
    });

    it('deletes tags and annotations belonging to removed descendants', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const gura = createCategory({ name: 'GURA', parentId: chars.id }).category;
      sqliteHandle.exec(`
        INSERT INTO documents (id, workspace_id, title) VALUES ('doc-1', 'ws-default', 'Lore');
        INSERT INTO sections (id, document_id, title, abbreviation, sort_order)
          VALUES ('sec-1', 'doc-1', 'Intro', 'IN', 1);
        INSERT INTO tags (id, category_id, name) VALUES ('tag-1', '${gura.id}', 'Shark');
        INSERT INTO annotations (id, section_id, tag_id, from_pos, to_pos)
          VALUES ('ann-1', 'sec-1', 'tag-1', 0, 5);
      `);

      deleteCategory(chars.id);

      expect(sqliteHandle.prepare('SELECT COUNT(*) c FROM tags').get()).toEqual({ c: 0 });
      expect(sqliteHandle.prepare('SELECT COUNT(*) c FROM annotations').get()).toEqual({ c: 0 });
      // The document and section are untouched.
      expect(sqliteHandle.prepare('SELECT COUNT(*) c FROM sections').get()).toEqual({ c: 1 });
    });

    it('deletes document_tags pointing at a removed category', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      sqliteHandle.exec(`
        INSERT INTO documents (id, workspace_id, title) VALUES ('doc-1', 'ws-default', 'Lore');
        INSERT INTO tags (id, category_id, name) VALUES ('tag-1', '${chars.id}', 'Shark');
        INSERT INTO document_tags (document_id, tag_id, category_id)
          VALUES ('doc-1', 'tag-1', '${chars.id}');
      `);

      deleteCategory(chars.id);

      expect(sqliteHandle.prepare('SELECT COUNT(*) c FROM document_tags').get()).toEqual({ c: 0 });
    });

    it('removes the rules of every deleted category', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const gura = createCategory({ name: 'GURA', parentId: chars.id }).category;
      setCategoryRule(chars.id, CHARACTER_RULE);
      setCategoryRule(gura.id, 'EARLY\nLATE');

      deleteCategory(chars.id);

      expect(sqliteHandle.prepare('SELECT COUNT(*) c FROM category_rules').get()).toEqual({ c: 0 });
    });

    it('leaves siblings alone', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      const gura = createCategory({ name: 'GURA', parentId: chars.id }).category;
      const pekora = createCategory({ name: 'PEKORA', parentId: chars.id }).category;

      deleteCategory(gura.id);

      expect(listCategories().map(c => c.id)).toContain(pekora.id);
      expect(childNames(chars.id)).toEqual(['PEKORA']);
    });
  });

  describe('collectCategoryIds', () => {
    it('returns the category plus every descendant', () => {
      const chars = createCategory({ workspaceId: 'ws-default', name: 'CHARACTERS' }).category;
      setCategoryRule(chars.id, 'ABILITIES\n  COMBAT');
      const gura = createCategory({ name: 'GURA', parentId: chars.id, applyRule: true }).category;

      const ids = collectCategoryIds(chars.id);
      expect(ids.length).toBe(4); // CHARACTERS, GURA, ABILITIES, COMBAT
      expect(ids[0]).toBe(chars.id);
      expect(ids).toContain(gura.id);
    });

    it('returns just the id for a leaf', () => {
      expect(collectCategoryIds('cat-1')).toEqual(['cat-1']);
    });
  });

  describe('updateCategory', () => {
    it('renames a category', () => {
      expect(updateCategory('cat-1', { name: 'Members' }).name).toBe('Members');
    });

    it('reparents a category', () => {
      expect(updateCategory('cat-2', { parentId: 'cat-1' }).parentId).toBe('cat-1');
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
