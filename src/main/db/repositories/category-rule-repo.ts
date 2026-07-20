import { eq } from 'drizzle-orm';
import { getDb } from '../connection';
import { categoryRules } from '../schema';
import { isRuleTemplateEmpty } from '../../../shared/category-rule';
import type { CategoryRule } from '../../../shared/domain-types';

export function listCategoryRules(): CategoryRule[] {
  return getDb().select().from(categoryRules).all();
}

export function getCategoryRule(categoryId: string): CategoryRule | null {
  return (
    getDb().select().from(categoryRules).where(eq(categoryRules.categoryId, categoryId)).get() ?? null
  );
}

/**
 * Upsert a category's rule. A template with no usable names deletes the rule outright —
 * clearing the editor is how you remove one, so there is no such thing as a stored
 * empty rule.
 */
export function setCategoryRule(categoryId: string, template: string): CategoryRule | null {
  const db = getDb();

  if (isRuleTemplateEmpty(template)) {
    deleteCategoryRule(categoryId);
    return null;
  }

  const row: CategoryRule = {
    categoryId,
    template,
    updatedAt: new Date().toISOString(),
  };

  db.insert(categoryRules)
    .values(row)
    .onConflictDoUpdate({
      target: categoryRules.categoryId,
      set: { template: row.template, updatedAt: row.updatedAt },
    })
    .run();

  return row;
}

export function deleteCategoryRule(categoryId: string): void {
  getDb().delete(categoryRules).where(eq(categoryRules.categoryId, categoryId)).run();
}
