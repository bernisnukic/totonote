import { v4 as uuid } from 'uuid';
import { getDb } from '../connection';
import type { Tag, CreateTagInput, UpdateTagInput } from '../../../shared/domain-types';

interface TagRow {
  id: string;
  category_id: string;
  name: string;
  color: string;
  description: string;
  created_at: string;
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    color: row.color,
    description: row.description,
    createdAt: row.created_at,
  };
}

export function listTags(categoryId?: string): Tag[] {
  if (categoryId) {
    const rows = getDb().prepare(
      'SELECT * FROM tags WHERE category_id = ? ORDER BY name'
    ).all(categoryId) as TagRow[];
    return rows.map(rowToTag);
  }
  const rows = getDb().prepare('SELECT * FROM tags ORDER BY name').all() as TagRow[];
  return rows.map(rowToTag);
}

export function createTag(input: CreateTagInput): Tag {
  const id = uuid();
  const now = new Date().toISOString();
  getDb().prepare(
    'INSERT INTO tags (id, category_id, name, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.categoryId, input.name, input.color || '#48dbfb', input.description || '', now);
  return { id, categoryId: input.categoryId, name: input.name, color: input.color || '#48dbfb', description: input.description || '', createdAt: now };
}

export function updateTag(input: UpdateTagInput): Tag {
  const row = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(input.id) as TagRow | undefined;
  if (!row) throw new Error(`Tag not found: ${input.id}`);

  const name = input.name ?? row.name;
  const color = input.color ?? row.color;
  const description = input.description ?? row.description;
  const categoryId = input.categoryId ?? row.category_id;

  getDb().prepare(
    'UPDATE tags SET name = ?, color = ?, description = ?, category_id = ? WHERE id = ?'
  ).run(name, color, description, categoryId, input.id);

  return rowToTag({ ...row, name, color, description, category_id: categoryId });
}

export function deleteTag(id: string): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(id);
}

export function searchTags(query: string): Tag[] {
  const rows = getDb().prepare(
    'SELECT * FROM tags WHERE name LIKE ? ORDER BY name LIMIT 50'
  ).all(`%${query}%`) as TagRow[];
  return rows.map(rowToTag);
}
