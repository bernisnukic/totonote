import type { ExcerptSort } from '../stores/filter-slice';

/**
 * Ordering and grouping for the whole-document excerpt views (Sort and Filter). Kept pure
 * and separate from FilteredView so the ordering rules can be tested without a live editor:
 * the component reads each excerpt's text from ProseMirror, then hands the metadata here.
 */
export interface ArrangeableExcerpt {
  id: string;
  /** Character position in its section — document order within a section. */
  from: number;
  /** ISO timestamp the excerpt was tagged. */
  createdAt: string;
  tagName: string;
  sectionId: string;
  sectionTitle: string;
  sectionSortOrder: number;
}

export interface ExcerptGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Arrange excerpts for display. Exactly one of the two shapes comes back:
 *   - `flat` (a single ordered list) for the date sorts — excerpts from different sections
 *     interleave, so grouping by section would be meaningless.
 *   - `groups` for document order (grouped by section, in section order) and by-tag
 *     (grouped by tag name, alphabetically).
 */
export function arrangeExcerpts<T extends ArrangeableExcerpt>(
  items: T[],
  sort: ExcerptSort,
): { flat: T[]; groups: null } | { flat: null; groups: ExcerptGroup<T>[] } {
  if (sort === 'newest' || sort === 'oldest') {
    const flat = [...items].sort((a, b) =>
      sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
    return { flat, groups: null };
  }

  const byKey = new Map<string, ExcerptGroup<T> & { order: number }>();
  for (const item of items) {
    const key = sort === 'tag' ? item.tagName.toLowerCase() : item.sectionId;
    const label = sort === 'tag' ? item.tagName : item.sectionTitle;
    const order = sort === 'tag' ? 0 : item.sectionSortOrder;
    const g = byKey.get(key) ?? { key, label, order, items: [] };
    g.items.push(item);
    byKey.set(key, g);
  }

  const groups = [...byKey.values()];
  groups.sort((a, b) => (sort === 'tag' ? a.label.localeCompare(b.label) : a.order - b.order));
  for (const g of groups) {
    // Within a section: document order (position). Within a tag: oldest-tagged first.
    g.items.sort((a, b) => (sort === 'tag' ? a.createdAt.localeCompare(b.createdAt) : a.from - b.from));
  }
  return { flat: null, groups: groups.map(({ key, label, items }) => ({ key, label, items })) };
}
