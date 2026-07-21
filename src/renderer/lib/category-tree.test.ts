import { describe, it, expect } from 'vitest';
import { flattenCategoryTree, optionIndent } from './category-tree';
import type { Category } from '../../shared/domain-types';

const cat = (id: string, name: string, parentId: string | null = null): Category => ({
  id,
  workspaceId: 'ws-default',
  name,
  parentId,
  sortOrder: 0,
});

describe('flattenCategoryTree', () => {
  it('returns roots in the order given', () => {
    const flat = flattenCategoryTree([cat('a', 'CHARACTERS'), cat('b', 'LOCATIONS')]);
    expect(flat.map(f => f.category.name)).toEqual(['CHARACTERS', 'LOCATIONS']);
    expect(flat.every(f => f.depth === 0)).toBe(true);
  });

  it('places children directly after their parent, one depth deeper', () => {
    const flat = flattenCategoryTree([
      cat('a', 'CHARACTERS'),
      cat('b', 'LOCATIONS'),
      cat('a1', 'GURA', 'a'),
    ]);
    expect(flat.map(f => `${'  '.repeat(f.depth)}${f.category.name}`)).toEqual([
      'CHARACTERS',
      '  GURA',
      'LOCATIONS',
    ]);
  });

  it('handles several levels of nesting', () => {
    const flat = flattenCategoryTree([
      cat('a', 'CHARACTERS'),
      cat('a1', 'GURA', 'a'),
      cat('a1a', 'HISTORY', 'a1'),
      cat('a1b', 'ABILITIES', 'a1'),
      cat('a2', 'PEKORA', 'a'),
    ]);
    expect(flat.map(f => `${'  '.repeat(f.depth)}${f.category.name}`)).toEqual([
      'CHARACTERS',
      '  GURA',
      '    HISTORY',
      '    ABILITIES',
      '  PEKORA',
    ]);
  });

  it('allows the same name under different parents', () => {
    const flat = flattenCategoryTree([
      cat('a', 'CHARACTERS'),
      cat('g', 'GURA', 'a'),
      cat('p', 'PEKORA', 'a'),
      cat('g1', 'HISTORY', 'g'),
      cat('p1', 'HISTORY', 'p'),
    ]);
    expect(flat.filter(f => f.category.name === 'HISTORY').length).toBe(2);
  });

  it('is empty for no categories', () => {
    expect(flattenCategoryTree([])).toEqual([]);
  });

  it('leaves out orphans whose parent is missing', () => {
    const flat = flattenCategoryTree([cat('a', 'CHARACTERS'), cat('x', 'LOST', 'gone')]);
    expect(flat.map(f => f.category.name)).toEqual(['CHARACTERS']);
  });

  it('does not loop forever on a cycle', () => {
    const flat = flattenCategoryTree([cat('a', 'A', 'b'), cat('b', 'B', 'a')]);
    expect(flat).toEqual([]);
  });

  it('visits each category once', () => {
    const flat = flattenCategoryTree([cat('a', 'A'), cat('b', 'B', 'a'), cat('c', 'C', 'b')]);
    expect(new Set(flat.map(f => f.category.id)).size).toBe(3);
  });
});

describe('optionIndent', () => {
  it('is empty at the root', () => {
    expect(optionIndent(0)).toBe('');
  });

  it('uses non-breaking spaces, which do not collapse inside <option>', () => {
    expect(optionIndent(1)).toBe('\u00A0\u00A0');
    expect(optionIndent(3)).toBe('\u00A0'.repeat(6));
  });
});
