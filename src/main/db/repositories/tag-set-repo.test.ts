import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;
vi.mock('../connection', () => ({ getDb: () => testDb }));

import { listTagSets, createTagSet, updateTagSet, deleteTagSet } from './tag-set-repo';

let sqlite: ReturnType<typeof createTestDb>['sqlite'];

function seedTags(...names: string[]) {
  sqlite.prepare(`INSERT INTO categories (id, workspace_id, name, sort_order) VALUES ('c1','ws-default','C',1)`).run();
  for (const name of names) {
    sqlite.prepare(`INSERT INTO tags (id, category_id, name, color) VALUES (?, 'c1', ?, '#48dbfb')`)
      .run(name.toLowerCase(), name);
  }
}

beforeEach(() => {
  const handles = createTestDb();
  testDb = handles.db;
  sqlite = handles.sqlite;
});

describe('tag sets', () => {
  it('remembers the tags it was given', () => {
    seedTags('A', 'B');
    const set = createTagSet('ws-default', 'Battles', ['a', 'b']);
    expect(set.name).toBe('Battles');
    expect(set.tagIds.sort()).toEqual(['a', 'b']);
    expect(listTagSets('ws-default')).toHaveLength(1);
  });

  it('refuses a set of one, which would just be the tag', () => {
    seedTags('A');
    expect(() => createTagSet('ws-default', 'Lonely', ['a'])).toThrow(/at least two/);
  });

  it('refuses a set with no name', () => {
    seedTags('A', 'B');
    expect(() => createTagSet('ws-default', '   ', ['a', 'b'])).toThrow(/needs a name/);
  });

  it('refuses a duplicate name, whatever the capitals', () => {
    seedTags('A', 'B');
    createTagSet('ws-default', 'Battles', ['a', 'b']);
    expect(() => createTagSet('ws-default', 'battles', ['a', 'b'])).toThrow(/already exists/);
  });

  it('ignores the same tag listed twice', () => {
    seedTags('A', 'B');
    expect(createTagSet('ws-default', 'Battles', ['a', 'b', 'a']).tagIds.sort()).toEqual(['a', 'b']);
  });

  it('replaces its membership when edited', () => {
    seedTags('A', 'B', 'C');
    const set = createTagSet('ws-default', 'Battles', ['a', 'b']);
    const updated = updateTagSet(set.id, 'Sieges', ['b', 'c']);
    expect(updated.name).toBe('Sieges');
    expect(updated.tagIds.sort()).toEqual(['b', 'c']);
    expect(listTagSets('ws-default')[0].tagIds.sort()).toEqual(['b', 'c']);
  });

  it('deleting a set leaves its tags alone', () => {
    // A set is a shortcut; deleting a shortcut must never delete what it points at.
    seedTags('A', 'B');
    const set = createTagSet('ws-default', 'Battles', ['a', 'b']);
    deleteTagSet(set.id);
    expect(listTagSets('ws-default')).toEqual([]);
    expect(sqlite.prepare(`SELECT count(*) AS n FROM tags`).get()).toEqual({ n: 2 });
  });

  it('deleting a tag removes it from the sets that held it', () => {
    seedTags('A', 'B', 'C');
    const set = createTagSet('ws-default', 'Battles', ['a', 'b', 'c']);
    sqlite.prepare(`DELETE FROM tags WHERE id = 'b'`).run();
    expect(listTagSets('ws-default')[0].tagIds.sort()).toEqual(['a', 'c']);
    expect(set.id).toBeTruthy();
  });

  it('keeps workspaces apart', () => {
    seedTags('A', 'B');
    createTagSet('ws-default', 'Battles', ['a', 'b']);
    expect(listTagSets('ws-other')).toEqual([]);
  });

  it('has none to begin with', () => {
    expect(listTagSets('ws-default')).toEqual([]);
  });
});
