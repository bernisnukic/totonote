import { v4 as uuid } from 'uuid';
import { eq } from 'drizzle-orm';
import { getDb } from '../connection';
import { captureSection } from './undo-repo';
import type { DeletionSnapshot } from '../../../shared/domain-types';
import { sections } from '../schema';
import type { Section, CreateSectionInput, UpdateSectionInput } from '../../../shared/domain-types';

export function listSections(documentId: string): Section[] {
  return getDb()
    .select()
    .from(sections)
    .where(eq(sections.documentId, documentId))
    .orderBy(sections.sortOrder)
    .all();
}

export function getSection(id: string): Section | null {
  const row = getDb().select().from(sections).where(eq(sections.id, id)).get();
  return row ?? null;
}

export function createSection(input: CreateSectionInput): Section {
  const now = new Date().toISOString();
  const section: Section = {
    id: uuid(),
    documentId: input.documentId,
    title: input.title,
    abbreviation: input.abbreviation,
    sortOrder: input.sortOrder,
    content: input.content ?? '',
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(sections).values(section).run();
  return section;
}

export function updateSection(input: UpdateSectionInput): Section {
  const existing = getSection(input.id);
  if (!existing) throw new Error(`Section not found: ${input.id}`);

  const updated: Section = {
    ...existing,
    title: input.title ?? existing.title,
    abbreviation: input.abbreviation ?? existing.abbreviation,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    content: input.content ?? existing.content,
    updatedAt: new Date().toISOString(),
  };
  getDb().update(sections).set(updated).where(eq(sections.id, input.id)).run();
  return updated;
}

export function deleteSection(id: string): DeletionSnapshot {
  const snapshot = captureSection(id);
  getDb().delete(sections).where(eq(sections.id, id)).run();
  return snapshot;
}

export function reorderSections(documentId: string, orderedIds: string[]): void {
  const db = getDb();
  db.transaction(tx => {
    orderedIds.forEach((id, index) => {
      tx.update(sections)
        .set({ sortOrder: index })
        .where(eq(sections.id, id))
        .run();
    });
  });
}
