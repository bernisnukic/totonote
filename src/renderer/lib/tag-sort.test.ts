import { describe, it, expect } from 'vitest';
import { sortTags, isTagSort, TAG_SORTS } from './tag-sort';
import type { Tag } from '../../shared/domain-types';

const tag = (id: string, name: string, createdAt: string): Tag =>
  ({ id, name, createdAt, categoryId: 'c', color: '#fff', description: '' });

const TAGS = [
  tag('b', 'Banner', '2026-03-01T00:00:00.000Z'),
  tag('a', 'anchor', '2026-01-01T00:00:00.000Z'),
  tag('c', 'Cutlass', '2026-02-01T00:00:00.000Z'),
];
const USAGE = new Map([['a', 9], ['c', 4]]); // 'b' never used

const names = (list: Tag[]) => list.map(t => t.name);

describe('ordering the tag list', () => {
  it('sorts by name regardless of capitals', () => {
    expect(names(sortTags(TAGS, 'name'))).toEqual(['anchor', 'Banner', 'Cutlass']);
  });

  it('puts the newest first, and the oldest first the other way', () => {
    expect(names(sortTags(TAGS, 'newest'))).toEqual(['Banner', 'Cutlass', 'anchor']);
    expect(names(sortTags(TAGS, 'oldest'))).toEqual(['anchor', 'Cutlass', 'Banner']);
  });

  it('sorts by how much each tag is actually used', () => {
    expect(names(sortTags(TAGS, 'most-used', USAGE))).toEqual(['anchor', 'Cutlass', 'Banner']);
  });

  it('counts a tag you have never used as least used, rather than hiding it', () => {
    // A tag with no highlights is exactly what "least used" is asking to be shown.
    expect(names(sortTags(TAGS, 'least-used', USAGE))).toEqual(['Banner', 'Cutlass', 'anchor']);
  });

  it('breaks ties by name, so the list does not reshuffle as you look at it', () => {
    const tied = [tag('x', 'Zephyr', '2026-01-01T00:00:00.000Z'), tag('y', 'Album', '2026-01-01T00:00:00.000Z')];
    expect(names(sortTags(tied, 'newest'))).toEqual(['Album', 'Zephyr']);
    expect(names(sortTags(tied, 'most-used'))).toEqual(['Album', 'Zephyr']);
  });

  it('leaves the order alone when it is arranged by hand', () => {
    expect(names(sortTags(TAGS, 'custom'))).toEqual(['Banner', 'anchor', 'Cutlass']);
  });

  it('never modifies the list it was given', () => {
    const input = [...TAGS];
    sortTags(input, 'name');
    expect(names(input)).toEqual(['Banner', 'anchor', 'Cutlass']);
  });

  it('recognises exactly the sorts it offers', () => {
    for (const { key } of TAG_SORTS) expect(isTagSort(key)).toBe(true);
    expect(isTagSort('sideways')).toBe(false);
  });
});
