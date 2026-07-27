import { v4 as uuid } from 'uuid';
import { and, eq, inArray, isNotNull, max, ne, sql } from 'drizzle-orm';
import { getDb } from '../connection';
import { annotations, sections, documents, tags } from '../schema';
import { excerptFromContent, imagesFromContent, drawingsFromContent } from '../../../shared/prosemirror-text';
import type {
  Annotation,
  AnnotationPlacement,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  PositionUpdate,
  FilingEdge,
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
      categoryId: annotations.categoryId,
      placementOrder: annotations.placementOrder,
      whenText: annotations.whenText,
      createdAt: annotations.createdAt,
    })
    .from(annotations)
    .innerJoin(sections, eq(sections.id, annotations.sectionId))
    .where(eq(sections.documentId, documentId))
    .orderBy(annotations.fromPos)
    .all();
  return rows;
}

/** Next placement_order for a category, so fresh filings land at the end of the page. */
function nextPlacementOrder(categoryId: string): number {
  const row = getDb()
    .select({ max: max(annotations.placementOrder) })
    .from(annotations)
    .where(eq(annotations.categoryId, categoryId))
    .get();
  return (row?.max ?? -1) + 1;
}

export function createAnnotation(input: CreateAnnotationInput): Annotation {
  // Tagging the same range with the same tag twice is never meant. It was easy to do by
  // accident on a picture, where nothing used to be drawn to show it had worked, so
  // people tagged the same image repeatedly and collected duplicates.
  const duplicate = getDb()
    .select()
    .from(annotations)
    .where(
      and(
        eq(annotations.sectionId, input.sectionId),
        eq(annotations.tagId, input.tagId),
        eq(annotations.fromPos, input.fromPos),
        eq(annotations.toPos, input.toPos),
      ),
    )
    .get();
  if (duplicate) return duplicate;

  const categoryId = input.categoryId ?? null;
  const annotation: Annotation = {
    id: uuid(),
    sectionId: input.sectionId,
    tagId: input.tagId,
    fromPos: input.fromPos,
    toPos: input.toPos,
    note: input.note ?? '',
    categoryId,
    placementOrder: categoryId ? nextPlacementOrder(categoryId) : 0,
    whenText: input.whenText ?? '',
    createdAt: new Date().toISOString(),
  };
  getDb().insert(annotations).values(annotation).run();
  return annotation;
}

export function updateAnnotation(input: UpdateAnnotationInput): Annotation {
  const existing = getDb().select().from(annotations).where(eq(annotations.id, input.id)).get();
  if (!existing) throw new Error(`Annotation not found: ${input.id}`);

  let categoryId = existing.categoryId;
  let placementOrder = existing.placementOrder;
  if (input.categoryId !== undefined && input.categoryId !== existing.categoryId) {
    categoryId = input.categoryId;
    // Refiled excerpts join the end of their new page section.
    placementOrder = categoryId ? nextPlacementOrder(categoryId) : 0;
  }

  const updated: Annotation = {
    ...existing,
    fromPos: input.fromPos ?? existing.fromPos,
    toPos: input.toPos ?? existing.toPos,
    note: input.note ?? existing.note,
    tagId: input.tagId ?? existing.tagId,
    whenText: input.whenText ?? existing.whenText,
    categoryId,
    placementOrder,
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

const placementColumns = {
  id: annotations.id,
  tagId: annotations.tagId,
  tagName: tags.name,
  tagColor: tags.color,
  categoryId: annotations.categoryId,
  placementOrder: annotations.placementOrder,
  whenText: annotations.whenText,
  fromPos: annotations.fromPos,
  toPos: annotations.toPos,
  note: annotations.note,
  createdAt: annotations.createdAt,
  sectionId: annotations.sectionId,
  sectionTitle: sections.title,
  sectionSortOrder: sections.sortOrder,
  documentId: sections.documentId,
  documentTitle: documents.title,
  content: sections.content,
};

/**
 * Filed annotations for the compiled wiki views, across every document. Excerpt text is
 * computed here from the stored section content — the renderer only has live editors
 * for the currently open document. Content lags the debounced save by up to a second,
 * which is fine for a browsing view.
 */
export function listPlacements(filter: { categoryIds?: string[]; tagId?: string }): AnnotationPlacement[] {
  const q = getDb()
    .select(placementColumns)
    .from(annotations)
    .innerJoin(tags, eq(tags.id, annotations.tagId))
    .innerJoin(sections, eq(sections.id, annotations.sectionId))
    .innerJoin(documents, eq(documents.id, sections.documentId))
    .orderBy(annotations.placementOrder, annotations.createdAt);

  let rows;
  if (filter.categoryIds) {
    if (filter.categoryIds.length === 0) return [];
    rows = q.where(inArray(annotations.categoryId, filter.categoryIds)).all();
  } else if (filter.tagId) {
    rows = q.where(eq(annotations.tagId, filter.tagId)).all();
  } else {
    rows = q.where(isNotNull(annotations.categoryId)).all();
  }

  return rows.map(({ content, ...row }) => ({
    ...row,
    excerpt: excerptFromContent(content, row.fromPos, row.toPos),
    imageIds: imagesFromContent(content, row.fromPos, row.toPos),
    drawingIds: drawingsFromContent(content, row.fromPos, row.toPos),
  }));
}

/**
 * Every excerpt that has been given a "when", across every document in a workspace.
 *
 * Ordering is left to the renderer: what a date means depends on shared/when.ts, which both
 * processes share, and SQL cannot sort "Year 300 of the Third Age" against "1885-03-12".
 */
export function listTimeline(workspaceId?: string): AnnotationPlacement[] {
  const q = getDb()
    .select(placementColumns)
    .from(annotations)
    .innerJoin(tags, eq(tags.id, annotations.tagId))
    .innerJoin(sections, eq(sections.id, annotations.sectionId))
    .innerJoin(documents, eq(documents.id, sections.documentId));

  const dated = ne(annotations.whenText, '');
  const rows = workspaceId
    ? q.where(and(dated, eq(documents.workspaceId, workspaceId))).all()
    : q.where(dated).all();

  return rows.map(({ content, ...row }) => ({
    ...row,
    excerpt: excerptFromContent(content, row.fromPos, row.toPos),
    imageIds: imagesFromContent(content, row.fromPos, row.toPos),
    drawingIds: drawingsFromContent(content, row.fromPos, row.toPos),
  }));
}

/** Persist a manual order for the excerpts filed under one category. */
export function reorderPlacements(categoryId: string, orderedIds: string[]): void {
  const db = getDb();
  db.transaction(tx => {
    orderedIds.forEach((id, index) => {
      tx.update(annotations)
        .set({ placementOrder: index })
        .where(eq(annotations.id, id))
        .run();
    });
  });
  // categoryId is part of the contract for clarity even though ids are globally unique.
  void categoryId;
}

/** Distinct tag→category filings with counts — the cross-links the graph draws. */
export function listFilingEdges(): FilingEdge[] {
  const rows = getDb()
    .select({
      tagId: annotations.tagId,
      categoryId: annotations.categoryId,
      count: sql<number>`count(*)`,
    })
    .from(annotations)
    .where(isNotNull(annotations.categoryId))
    .groupBy(annotations.tagId, annotations.categoryId)
    .all();
  return rows.filter((r): r is FilingEdge => r.categoryId !== null);
}
