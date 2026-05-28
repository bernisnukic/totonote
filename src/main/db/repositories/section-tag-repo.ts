import { eq, and } from 'drizzle-orm';
import { getDb } from '../connection';
import { sectionTags, tags, categories, sections } from '../schema';
import type { SectionTagWithDetails } from '../../../shared/domain-types';

const detailColumns = {
  sectionId: sectionTags.sectionId,
  tagId: sectionTags.tagId,
  tagName: tags.name,
  tagColor: tags.color,
  categoryId: tags.categoryId,
  categoryName: categories.name,
  createdAt: sectionTags.createdAt,
};

export function listSectionTags(sectionId: string): SectionTagWithDetails[] {
  return getDb()
    .select(detailColumns)
    .from(sectionTags)
    .innerJoin(tags, eq(tags.id, sectionTags.tagId))
    .innerJoin(categories, eq(categories.id, tags.categoryId))
    .where(eq(sectionTags.sectionId, sectionId))
    .orderBy(sectionTags.createdAt)
    .all();
}

export function listSectionTagsByDocument(documentId: string): SectionTagWithDetails[] {
  return getDb()
    .select(detailColumns)
    .from(sectionTags)
    .innerJoin(tags, eq(tags.id, sectionTags.tagId))
    .innerJoin(categories, eq(categories.id, tags.categoryId))
    .innerJoin(sections, eq(sections.id, sectionTags.sectionId))
    .where(eq(sections.documentId, documentId))
    .orderBy(sectionTags.createdAt)
    .all();
}

export function addSectionTag(sectionId: string, tagId: string): void {
  getDb().insert(sectionTags).values({ sectionId, tagId }).onConflictDoNothing().run();
}

export function removeSectionTag(sectionId: string, tagId: string): void {
  getDb()
    .delete(sectionTags)
    .where(and(eq(sectionTags.sectionId, sectionId), eq(sectionTags.tagId, tagId)))
    .run();
}
