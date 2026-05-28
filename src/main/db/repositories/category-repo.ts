import { randomUUID } from 'crypto';
import { eq, max } from 'drizzle-orm';
import { getDb } from '../connection';
import { categories, browseCategories } from '../schema';
import type { Category, BrowseCategory } from '../../../shared/domain-types';

export function listCategories(): Category[] {
  return getDb().select().from(categories).orderBy(categories.sortOrder).all();
}

export function createCategory(name: string, parentId?: string): Category {
  const db = getDb();
  const maxRow = db.select({ max: max(categories.sortOrder) }).from(categories).get();
  const sortOrder = (maxRow?.max ?? 0) + 1;
  const category: Category = {
    id: `cat-${randomUUID()}`,
    name,
    parentId: parentId ?? null,
    sortOrder,
  };
  db.insert(categories).values(category).run();
  return category;
}

export function updateCategory(
  id: string,
  updates: { name?: string; parentId?: string | null },
): Category {
  const db = getDb();
  const patch: Partial<Category> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.parentId !== undefined) patch.parentId = updates.parentId;
  if (Object.keys(patch).length > 0) {
    db.update(categories).set(patch).where(eq(categories.id, id)).run();
  }
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}

export function deleteCategory(id: string): void {
  getDb().delete(categories).where(eq(categories.id, id)).run();
}

export function listBrowseCategories(): BrowseCategory[] {
  return getDb().select().from(browseCategories).orderBy(browseCategories.sortOrder).all();
}
