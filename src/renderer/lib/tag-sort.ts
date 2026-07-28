import type { Tag } from '../../shared/domain-types';

/**
 * Ordering the tag list.
 *
 * Asked for as "sort by newest/oldest, alphabetical, most/least amount of highlights,
 * custom order". Alphabetical is the default because it is the only one you can predict
 * without looking; the rest answer particular questions — what have I just made, what am I
 * actually using, what have I stopped using.
 *
 * "Custom" is deliberately not a sort at all: it means "leave them as they are", which is
 * whatever order the database returns and, in time, whatever order someone drags them into.
 */
export type TagSort = 'name' | 'newest' | 'oldest' | 'most-used' | 'least-used' | 'custom';

export const TAG_SORTS: Array<{ key: TagSort; label: string }> = [
  { key: 'name', label: 'A → Z' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'most-used', label: 'Most used' },
  { key: 'least-used', label: 'Least used' },
  { key: 'custom', label: 'As arranged' },
];

export function isTagSort(value: string): value is TagSort {
  return TAG_SORTS.some(s => s.key === value);
}

/**
 * `usage` maps a tag id to how many highlights carry it. A tag missing from it counts as
 * zero rather than being dropped — a tag you have never used is exactly what "least used"
 * is asking to see.
 */
export function sortTags(tags: Tag[], sort: TagSort, usage: Map<string, number> = new Map()): Tag[] {
  const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const used = (t: Tag) => usage.get(t.id) ?? 0;
  const copy = [...tags];

  switch (sort) {
    case 'name':
      return copy.sort(byName);
    case 'newest':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b));
    case 'oldest':
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || byName(a, b));
    // Ties fall back to the name so the list does not reshuffle between renders.
    case 'most-used':
      return copy.sort((a, b) => used(b) - used(a) || byName(a, b));
    case 'least-used':
      return copy.sort((a, b) => used(a) - used(b) || byName(a, b));
    case 'custom':
    default:
      return copy;
  }
}
