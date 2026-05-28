import { v4 as uuid } from 'uuid';
import { eq } from 'drizzle-orm';
import { getDb } from '../connection';
import { annotations, sections } from '../schema';
import type {
  Annotation,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  PositionUpdate,
} from '../../../shared/domain-types';

export function listAnnotations(sectionId: string): Annotation[] {
  return getDb()
    .select()
    .from(annotations)
    .where(eq(annotations.sectionId, sectionId))
    .orderBy(annotations.fromPos)
    .all();
}

export function listAnnotationsByDocument(documentId: string): Annotation[] {
  const rows = getDb()
    .select({
      id: annotations.id,
      sectionId: annotations.sectionId,
      tagId: annotations.tagId,
      fromPos: annotations.fromPos,
      toPos: annotations.toPos,
      note: annotations.note,
      createdAt: annotations.createdAt,
    })
    .from(annotations)
    .innerJoin(sections, eq(sections.id, annotations.sectionId))
    .where(eq(sections.documentId, documentId))
    .orderBy(annotations.fromPos)
    .all();
  return rows;
}

export function createAnnotation(input: CreateAnnotationInput): Annotation {
  const annotation: Annotation = {
    id: uuid(),
    sectionId: input.sectionId,
    tagId: input.tagId,
    fromPos: input.fromPos,
    toPos: input.toPos,
    note: input.note ?? '',
    createdAt: new Date().toISOString(),
  };
  getDb().insert(annotations).values(annotation).run();
  return annotation;
}

export function updateAnnotation(input: UpdateAnnotationInput): Annotation {
  const existing = getDb().select().from(annotations).where(eq(annotations.id, input.id)).get();
  if (!existing) throw new Error(`Annotation not found: ${input.id}`);

  const updated: Annotation = {
    ...existing,
    fromPos: input.fromPos ?? existing.fromPos,
    toPos: input.toPos ?? existing.toPos,
    note: input.note ?? existing.note,
    tagId: input.tagId ?? existing.tagId,
  };
  getDb().update(annotations).set(updated).where(eq(annotations.id, input.id)).run();
  return updated;
}

export function deleteAnnotation(id: string): void {
  getDb().delete(annotations).where(eq(annotations.id, id)).run();
}

export function batchUpdatePositions(updates: PositionUpdate[]): void {
  const db = getDb();
  db.transaction(tx => {
    for (const u of updates) {
      tx.update(annotations)
        .set({ fromPos: u.fromPos, toPos: u.toPos })
        .where(eq(annotations.id, u.id))
        .run();
    }
  });
}
