import { describe, it, expect } from 'vitest';
import { categoryImpact, describeCategoryDeletion } from './category-impact';
import type { Category, Tag } from '../../shared/domain-types';

const cat = (id: string, parentId: string | null = null): Category => ({
  id,
  workspaceId: 'ws-1',
  name: id.toUpperCase(),
  parentId,
  sortOrder: 0,
});

const tag = (id: string, categoryId: string): Tag => ({
  id,
  categoryId,
  name: id,
  color: '#48dbfb',
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
});

//  characters
//  ├── gura
//  │   └── history
//  └── pekora
const tree = [cat('characters'), cat('gura', 'characters'), cat('history', 'gura'), cat('pekora', 'characters')];

describe('categoryImpact', () => {
  it('collects descendants at every depth, not just direct children', () => {
    const { descendantIds } = categoryImpact('characters', tree, []);
    expect([...descendantIds].sort()).toEqual(['gura', 'history', 'pekora']);
  });

  it('excludes the category itself from the descendant set', () => {
    const { descendantIds } = categoryImpact('characters', tree, []);
    expect(descendantIds.has('characters')).toBe(false);
  });

  it('is empty for a leaf', () => {
    expect(categoryImpact('history', tree, []).descendantIds.size).toBe(0);
  });

  it('counts tags on the target and anywhere beneath it', () => {
    const tags = [tag('t1', 'characters'), tag('t2', 'history'), tag('t3', 'elsewhere')];
    const { doomedTags } = categoryImpact('characters', tree, tags);
    expect(doomedTags.map(t => t.id)).toEqual(['t1', 't2']);
  });

  it('leaves a sibling subtree alone', () => {
    const tags = [tag('t1', 'gura'), tag('t2', 'pekora')];
    const { descendantIds, doomedTags } = categoryImpact('gura', tree, tags);
    expect([...descendantIds]).toEqual(['history']);
    expect(doomedTags.map(t => t.id)).toEqual(['t1']);
  });

  it('terminates on a malformed parent cycle', () => {
    // Two categories claiming each other as parent must not hang the UI.
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect(() => categoryImpact('a', cyclic, [])).not.toThrow();
    expect(categoryImpact('a', cyclic, []).descendantIds.has('a')).toBe(false);
  });
});

describe('describeCategoryDeletion', () => {
  const impact = (subs: string[], tagCount: number) => ({
    descendantIds: new Set(subs),
    doomedTags: Array.from({ length: tagCount }, (_, i) => tag(`t${i}`, 'x')),
  });

  it('says just the name when nothing else is affected', () => {
    expect(describeCategoryDeletion('LORE', impact([], 0))).toBe('Delete category "LORE"?');
  });

  it('singularises one sub-category and one tag', () => {
    expect(describeCategoryDeletion('GURA', impact(['history'], 1))).toBe(
      'Delete category "GURA" and its 1 sub-category and 1 tag?',
    );
  });

  it('pluralises correctly', () => {
    expect(describeCategoryDeletion('CHARACTERS', impact(['a', 'b'], 3))).toBe(
      'Delete category "CHARACTERS" and its 2 sub-categories and 3 tags?',
    );
  });

  it('mentions only what is actually affected', () => {
    expect(describeCategoryDeletion('X', impact(['a'], 0))).toBe(
      'Delete category "X" and its 1 sub-category?',
    );
    expect(describeCategoryDeletion('X', impact([], 2))).toBe('Delete category "X" and its 2 tags?');
  });
});
