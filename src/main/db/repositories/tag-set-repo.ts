import { v4 as uuid } from 'uuid';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../connection';
import { tagSets, tagSetMembers } from '../schema';
import type { TagSet } from '../../../shared/domain-types';

/**
 * Named groups of tags, applied together.
 *
 * See the schema comment: a set is a shortcut, not a tag. Applying one puts its member
 * tags on the text, so combinations compose — text carrying four tags satisfies every
 * pair of them without anybody having to say so in advance.
 */

/** Every set in a workspace, each with the tags it holds. */
export function listTagSets(workspaceId: string): TagSet[] {
  const sets = getDb()
    .select()
    .from(tagSets)
    .where(eq(tagSets.workspaceId, workspaceId))
    .orderBy(tagSets.name)
    .all();
  if (sets.length === 0) return [];

  const members = getDb()
    .select()
    .from(tagSetMembers)
    .where(inArray(tagSetMembers.tagSetId, sets.map(s => s.id)))
    .all();

  return sets.map(set => ({
    ...set,
    tagIds: members.filter(m => m.tagSetId === set.id).map(m => m.tagId),
  }));
}

export function createTagSet(workspaceId: string, name: string, tagIds: string[]): TagSet {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('A tag set needs a name');
  if (tagIds.length < 2) throw new Error('A tag set needs at least two tags — otherwise it is just the tag');

  const existing = getDb()
    .select()
    .from(tagSets)
    .where(eq(tagSets.workspaceId, workspaceId))
    .all()
    .find(s => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) throw new Error(`A tag set named "${trimmed}" already exists`);

  const set = {
    id: uuid(),
    workspaceId,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  const db = getDb();
  db.transaction(tx => {
    tx.insert(tagSets).values(set).run();
    for (const tagId of unique(tagIds)) {
      tx.insert(tagSetMembers).values({ tagSetId: set.id, tagId }).run();
    }
  });
  return { ...set, tagIds: unique(tagIds) };
}

export function updateTagSet(id: string, name: string, tagIds: string[]): TagSet {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('A tag set needs a name');
  if (tagIds.length < 2) throw new Error('A tag set needs at least two tags — otherwise it is just the tag');

  const db = getDb();
  db.transaction(tx => {
    tx.update(tagSets).set({ name: trimmed }).where(eq(tagSets.id, id)).run();
    // Replace the membership wholesale: working out which rows changed buys nothing here.
    tx.delete(tagSetMembers).where(eq(tagSetMembers.tagSetId, id)).run();
    for (const tagId of unique(tagIds)) {
      tx.insert(tagSetMembers).values({ tagSetId: id, tagId }).run();
    }
  });
  const set = db.select().from(tagSets).where(eq(tagSets.id, id)).get();
  if (!set) throw new Error(`Tag set not found: ${id}`);
  return { ...set, tagIds: unique(tagIds) };
}

export function deleteTagSet(id: string): void {
  // Members go with it by cascade. The tags themselves are untouched — a set is a
  // shortcut, and deleting a shortcut must never delete what it pointed at.
  getDb().delete(tagSets).where(eq(tagSets.id, id)).run();
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
