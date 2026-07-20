import type { Category } from '../../shared/domain-types';

export interface CategoryWithDepth {
  category: Category;
  depth: number;
}

/**
 * Flatten the category tree depth-first, tagging each entry with its nesting depth.
 *
 * Siblings keep the order they arrive in, so callers control sorting by how they load
 * categories. Anything unreachable from a root — an orphan whose parent is gone, or a
 * cycle — is left out rather than looped over forever.
 */
export function flattenCategoryTree(categories: Category[]): CategoryWithDepth[] {
  const result: CategoryWithDepth[] = [];
  const seen = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    for (const category of categories) {
      if (category.parentId !== parentId) continue;
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      result.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };

  walk(null, 0);
  return result;
}

/**
 * Leading padding for a nested `<option>`. Regular spaces collapse inside `<option>`,
 * so this has to be non-breaking ones.
 */
export function optionIndent(depth: number): string {
  return '\u00A0\u00A0'.repeat(depth);
}
