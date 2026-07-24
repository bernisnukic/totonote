import type { Category, Tag } from '../../shared/domain-types';

/**
 * What deleting a category would actually destroy.
 *
 * Deleting is recursive — the whole subtree goes, and every tag inside it. The confirm
 * dialog has to say so, and it used to undercount by looking at direct children only.
 * Kept out of the component so the arithmetic behind a destructive prompt is testable.
 */
export interface CategoryImpact {
  /** Every category below the target, at any depth (excluding the target itself). */
  descendantIds: Set<string>;
  /** Tags that live on the target or anywhere beneath it. */
  doomedTags: Tag[];
}

export function categoryImpact(categoryId: string, categories: Category[], tags: Tag[]): CategoryImpact {
  const descendantIds = new Set<string>();
  const queue = [categoryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const c of categories) {
      // The `has` guard also stops a malformed parent cycle from looping forever.
      if (c.parentId === current && !descendantIds.has(c.id) && c.id !== categoryId) {
        descendantIds.add(c.id);
        queue.push(c.id);
      }
    }
  }
  const doomedTags = tags.filter(t => t.categoryId === categoryId || descendantIds.has(t.categoryId));
  return { descendantIds, doomedTags };
}

/** The confirm-dialog wording for that impact — plural-correct, and silent about zeroes. */
export function describeCategoryDeletion(name: string, impact: CategoryImpact): string {
  const { descendantIds, doomedTags } = impact;
  const parts: string[] = [];
  if (descendantIds.size > 0) {
    parts.push(`${descendantIds.size} sub-categor${descendantIds.size === 1 ? 'y' : 'ies'}`);
  }
  if (doomedTags.length > 0) {
    parts.push(`${doomedTags.length} tag${doomedTags.length === 1 ? '' : 's'}`);
  }
  return parts.length > 0
    ? `Delete category "${name}" and its ${parts.join(' and ')}?`
    : `Delete category "${name}"?`;
}
