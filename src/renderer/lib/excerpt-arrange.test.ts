import { describe, it, expect } from 'vitest';
import { arrangeExcerpts, type ArrangeableExcerpt } from './excerpt-arrange';

/** Build a test excerpt; every field has a sensible default so tests set only what they assert on. */
function ex(over: Partial<ArrangeableExcerpt> & { id: string }): ArrangeableExcerpt {
  return {
    from: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    tagName: 'Tag',
    sectionId: 's1',
    sectionTitle: 'Section 1',
    sectionSortOrder: 0,
    ...over,
  };
}

const ids = (list: { id: string }[]) => list.map(i => i.id);

describe('arrangeExcerpts', () => {
  it('newest sorts by createdAt descending as one flat list', () => {
    const items = [
      ex({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      ex({ id: 'b', createdAt: '2026-03-01T00:00:00.000Z' }),
      ex({ id: 'c', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const { flat, groups } = arrangeExcerpts(items, 'newest');
    expect(groups).toBeNull();
    expect(ids(flat!)).toEqual(['b', 'c', 'a']);
  });

  it('oldest sorts by createdAt ascending', () => {
    const items = [
      ex({ id: 'a', createdAt: '2026-03-01T00:00:00.000Z' }),
      ex({ id: 'b', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const { flat } = arrangeExcerpts(items, 'oldest');
    expect(ids(flat!)).toEqual(['b', 'a']);
  });

  it('the date sorts interleave excerpts from different sections', () => {
    const items = [
      ex({ id: 'a', sectionId: 's1', createdAt: '2026-01-03T00:00:00.000Z' }),
      ex({ id: 'b', sectionId: 's2', createdAt: '2026-01-02T00:00:00.000Z' }),
      ex({ id: 'c', sectionId: 's1', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const { flat } = arrangeExcerpts(items, 'oldest');
    expect(ids(flat!)).toEqual(['c', 'b', 'a']);
  });

  it('document order groups by section, sections in sortOrder, items by position', () => {
    const items = [
      ex({ id: 'a', sectionId: 's2', sectionTitle: 'Two', sectionSortOrder: 1, from: 50 }),
      ex({ id: 'b', sectionId: 's1', sectionTitle: 'One', sectionSortOrder: 0, from: 30 }),
      ex({ id: 'c', sectionId: 's1', sectionTitle: 'One', sectionSortOrder: 0, from: 10 }),
    ];
    const { flat, groups } = arrangeExcerpts(items, 'document');
    expect(flat).toBeNull();
    expect(groups!.map(g => g.label)).toEqual(['One', 'Two']);
    expect(ids(groups![0].items)).toEqual(['c', 'b']); // by position within the section
    expect(ids(groups![1].items)).toEqual(['a']);
  });

  it('by-tag groups by tag name alphabetically, case-insensitively', () => {
    const items = [
      ex({ id: 'a', tagName: 'Zephyr' }),
      ex({ id: 'b', tagName: 'apple' }),
      ex({ id: 'c', tagName: 'Apple' }), // same group as 'apple', different case
    ];
    const { groups } = arrangeExcerpts(items, 'tag');
    expect(groups!.map(g => g.label.toLowerCase())).toEqual(['apple', 'zephyr']);
    expect(ids(groups![0].items).sort()).toEqual(['b', 'c']);
  });

  it('by-tag orders excerpts within a tag oldest-first', () => {
    const items = [
      ex({ id: 'a', tagName: 'T', createdAt: '2026-02-01T00:00:00.000Z' }),
      ex({ id: 'b', tagName: 'T', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const { groups } = arrangeExcerpts(items, 'tag');
    expect(ids(groups![0].items)).toEqual(['b', 'a']);
  });

  it('handles an empty list without throwing', () => {
    expect(arrangeExcerpts([], 'document')).toEqual({ flat: null, groups: [] });
    expect(arrangeExcerpts([], 'newest')).toEqual({ flat: [], groups: null });
  });
});
