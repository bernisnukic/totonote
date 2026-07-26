import { flattenCategoryTree, type CategoryWithDepth } from './category-tree';
import type { Category } from '../../shared/domain-types';

/**
 * Which categories an excerpt can be filed under.
 *
 * A tag already says what the text is about, so the pages it plausibly belongs on are its
 * own category and whatever sits beneath that — filing a GURA-tagged line under LOCATIONS
 * is nearly always a misclick, and with a long category list it is an easy one to make.
 *
 * The narrowing is a default, not a rule: `showAll` gives the whole tree back, because
 * "nearly always" is not "always" and nobody should be stuck.
 */
export function filingChoices(
  categories: Category[],
  tagCategoryId: string | null | undefined,
  showAll: boolean,
): CategoryWithDepth[] {
  const everything = flattenCategoryTree(categories);
  if (showAll || !tagCategoryId) return everything;

  const root = everything.find(c => c.category.id === tagCategoryId);
  if (!root) return everything;

  // The tag's own category, then everything under it, with depth measured from the root
  // so the indentation starts at zero rather than wherever it sat in the whole tree.
  const kept: CategoryWithDepth[] = [];
  const descendants = new Set([tagCategoryId]);
  for (const entry of everything) {
    const isRoot = entry.category.id === tagCategoryId;
    const isChild = entry.category.parentId != null && descendants.has(entry.category.parentId);
    if (!isRoot && !isChild) continue;
    descendants.add(entry.category.id);
    kept.push({ category: entry.category, depth: entry.depth - root.depth });
  }

  // A tag sitting in a category with nothing beneath it — the default "General", most
  // often — would narrow to a single choice, which is a dead end rather than a shortlist.
  // There is nothing to narrow *to*, so don't pretend otherwise.
  return kept.length > 1 ? kept : everything;
}

/** True when narrowing would actually hide something, i.e. the escape hatch is worth showing. */
export function narrowingHidesSomething(
  categories: Category[],
  tagCategoryId: string | null | undefined,
): boolean {
  if (!tagCategoryId) return false;
  return filingChoices(categories, tagCategoryId, false).length < flattenCategoryTree(categories).length;
}
