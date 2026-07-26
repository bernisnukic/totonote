import { describe, it, expect } from 'vitest';
import { filingChoices, narrowingHidesSomething } from './filing-options';
import type { Category } from '../../shared/domain-types';

const cat = (id: string, name: string, parentId: string | null = null): Category =>
  ({ id, name, parentId, workspaceId: 'ws', sortOrder: 0, createdAt: '' }) as Category;

//  CHARACTERS            LOCATIONS
//    GURA                  ATLANTIS
//      HISTORY
//      ABILITIES
const TREE = [
  cat('chars', 'CHARACTERS'),
  cat('gura', 'GURA', 'chars'),
  cat('history', 'HISTORY', 'gura'),
  cat('abilities', 'ABILITIES', 'gura'),
  cat('locations', 'LOCATIONS'),
  cat('atlantis', 'ATLANTIS', 'locations'),
];

const names = (rows: ReturnType<typeof filingChoices>) => rows.map(r => r.category.name);

describe('where an excerpt may be filed', () => {
  it("offers the tag's own category and everything under it", () => {
    expect(names(filingChoices(TREE, 'gura', false))).toEqual(['GURA', 'HISTORY', 'ABILITIES']);
  });

  it('leaves out the rest of the world, which is where the misclicks come from', () => {
    expect(names(filingChoices(TREE, 'gura', false))).not.toContain('LOCATIONS');
    expect(names(filingChoices(TREE, 'gura', false))).not.toContain('ATLANTIS');
  });

  it('indents from the tag`s category, not from the top of the tree', () => {
    const rows = filingChoices(TREE, 'gura', false);
    expect(rows.map(r => r.depth)).toEqual([0, 1, 1]);
  });

  it('gives the whole tree back when asked to show everything', () => {
    expect(names(filingChoices(TREE, 'gura', true))).toEqual([
      'CHARACTERS', 'GURA', 'HISTORY', 'ABILITIES', 'LOCATIONS', 'ATLANTIS',
    ]);
  });

  it('includes a whole branch, not just direct children', () => {
    expect(names(filingChoices(TREE, 'chars', false))).toEqual([
      'CHARACTERS', 'GURA', 'HISTORY', 'ABILITIES',
    ]);
  });

  it('falls back to everything for a tag with no category', () => {
    expect(names(filingChoices(TREE, null, false))).toHaveLength(6);
    expect(names(filingChoices(TREE, undefined, false))).toHaveLength(6);
  });

  it('falls back to everything if the category no longer exists', () => {
    expect(names(filingChoices(TREE, 'deleted-id', false))).toHaveLength(6);
  });

  it('falls back to everything when the tag sits in a category with nothing under it', () => {
    // Narrowing to a single option is a dead end, not a shortlist — and the default
    // "General" category is exactly that case, which is where most new tags land.
    expect(names(filingChoices(TREE, 'atlantis', false))).toHaveLength(6);
  });

  it('still narrows when the branch has something in it', () => {
    expect(names(filingChoices(TREE, 'gura', false))).toHaveLength(3);
  });
});

describe('whether to offer the escape hatch', () => {
  it('is worth offering when narrowing hides categories', () => {
    expect(narrowingHidesSomething(TREE, 'gura')).toBe(true);
  });

  it('is pointless when the tag has no category', () => {
    expect(narrowingHidesSomething(TREE, null)).toBe(false);
  });

  it('is pointless when the tag`s category is the whole tree', () => {
    expect(narrowingHidesSomething([cat('only', 'ONLY')], 'only')).toBe(false);
  });

  it('is pointless for a leaf category, which no longer narrows at all', () => {
    expect(narrowingHidesSomething(TREE, 'atlantis')).toBe(false);
  });
});
