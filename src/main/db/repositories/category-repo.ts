import { randomUUID } from 'crypto';
import { getDb } from '../connection';
import type { Category, BrowseCategory } from '../../../shared/domain-types';

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

interface BrowseCategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

function rowToCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, parentId: row.parent_id, sortOrder: row.sort_order };
}

export function listCategories(): Category[] {
  const rows = getDb().prepare(
    'SELECT * FROM categories ORDER BY sort_order'
  ).all() as CategoryRow[];
  return rows.map(rowToCategory);
}

export function createCategory(name: string, parentId?: string): Category {
  const id = `cat-${randomUUID()}`;
  const db = getDb();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM categories').get() as { max_order: number };
  const sortOrder = maxOrder.max_order + 1;
  db.prepare('INSERT INTO categories (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)').run(id, name, parentId ?? null, sortOrder);
  return { id, name, parentId: parentId ?? null, sortOrder };
}

export function updateCategory(id: string, updates: { name?: string; parentId?: string | null }): Category {
  const db = getDb();
  const sets: string[] = [];
  const params: (string | null)[] = [];
  if (updates.name !== undefined) {
    sets.push('name = ?');
    params.push(updates.name);
  }
  if (updates.parentId !== undefined) {
    sets.push('parent_id = ?');
    params.push(updates.parentId);
  }
  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow;
  return rowToCategory(row);
}

export function deleteCategory(id: string): void {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id);
}

export function listBrowseCategories(): BrowseCategory[] {
  const rows = getDb().prepare(
    'SELECT * FROM browse_categories ORDER BY sort_order'
  ).all() as BrowseCategoryRow[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
  }));
}
