import { eq, and } from 'drizzle-orm';
import { getDb } from '../connection';
import { preferences, documentTags, tags, categories } from '../schema';
import type { DocumentTagWithDetails } from '../../../shared/domain-types';

// Preferences
export function getPreference(key: string): string | null {
  const row = getDb().select().from(preferences).where(eq(preferences.key, key)).get();
  return row?.value ?? null;
}

export function setPreference(key: string, value: string): void {
  getDb()
    .insert(preferences)
    .values({ key, value })
    .onConflictDoUpdate({ target: preferences.key, set: { value } })
    .run();
}

// Document Tags
export function listDocumentTags(documentId: string): DocumentTagWithDetails[] {
  return getDb()
    .select({
      documentId: documentTags.documentId,
      tagId: documentTags.tagId,
      categoryId: documentTags.categoryId,
      tagName: tags.name,
      tagColor: tags.color,
      categoryName: categories.name,
    })
    .from(documentTags)
    .innerJoin(tags, eq(tags.id, documentTags.tagId))
    .innerJoin(categories, eq(categories.id, documentTags.categoryId))
    .where(eq(documentTags.documentId, documentId))
    .orderBy(categories.sortOrder, tags.name)
    .all();
}

export function addDocumentTag(documentId: string, tagId: string, categoryId: string): void {
  getDb()
    .insert(documentTags)
    .values({ documentId, tagId, categoryId })
    .onConflictDoNothing()
    .run();
}

export function removeDocumentTag(documentId: string, tagId: string): void {
  getDb()
    .delete(documentTags)
    .where(and(eq(documentTags.documentId, documentId), eq(documentTags.tagId, tagId)))
    .run();
}
