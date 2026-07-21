import { v4 as uuid } from 'uuid';
import { eq, like } from 'drizzle-orm';
import { getDb } from '../connection';
import { captureTag } from './undo-repo';
import type { DeletionSnapshot } from '../../../shared/domain-types';
import { tags } from '../schema';
import type { Tag, CreateTagInput, UpdateTagInput } from '../../../shared/domain-types';

export function listTags(categoryId?: string): Tag[] {
  const q = getDb().select().from(tags).orderBy(tags.name);
  return (categoryId ? q.where(eq(tags.categoryId, categoryId)) : q).all();
}

export function createTag(input: CreateTagInput): Tag {
  const tag: Tag = {
    id: uuid(),
    categoryId: input.categoryId,
    name: input.name,
    color: input.color ?? '#48dbfb',
    description: input.description ?? '',
    createdAt: new Date().toISOString(),
  };
  getDb().insert(tags).values(tag).run();
  return tag;
}

export function updateTag(input: UpdateTagInput): Tag {
  const existing = getDb().select().from(tags).where(eq(tags.id, input.id)).get();
  if (!existing) throw new Error(`Tag not found: ${input.id}`);

  const updated: Tag = {
    ...existing,
    name: input.name ?? existing.name,
    color: input.color ?? existing.color,
    description: input.description ?? existing.description,
    categoryId: input.categoryId ?? existing.categoryId,
  };
  getDb().update(tags).set(updated).where(eq(tags.id, input.id)).run();
  return updated;
}

export function deleteTag(id: string): DeletionSnapshot {
  const snapshot = captureTag(id);
  getDb().delete(tags).where(eq(tags.id, id)).run();
  return snapshot;
}

export function searchTags(query: string): Tag[] {
  return getDb()
    .select()
    .from(tags)
    .where(like(tags.name, `%${query}%`))
    .orderBy(tags.name)
    .limit(50)
    .all();
}
