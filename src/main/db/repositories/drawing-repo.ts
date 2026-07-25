import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../connection';
import { drawings } from '../schema';
import type { DrawingRecord, SaveDrawingInput } from '../../../shared/domain-types';

/**
 * Freehand drawings. Unlike media, these are mutable — the id in the document stays put
 * while the strokes underneath are rewritten on every edit.
 */

export function createDrawing(input: { backgroundMediaId?: string | null; aspectRatio?: number }): DrawingRecord {
  const id = randomUUID();
  const row = {
    id,
    strokes: '',
    backgroundMediaId: input.backgroundMediaId ?? null,
    aspectRatio: input.aspectRatio ?? 1.5,
  };
  getDb().insert(drawings).values(row).run();
  return getDrawing(id)!;
}

export function getDrawing(id: string): DrawingRecord | null {
  const row = getDb().select().from(drawings).where(eq(drawings.id, id)).get();
  return row ?? null;
}

/** Replace a drawing's strokes. Returns null if the drawing has since been removed. */
export function saveDrawing(input: SaveDrawingInput): DrawingRecord | null {
  const existing = getDrawing(input.id);
  if (!existing) return null;
  getDb()
    .update(drawings)
    .set({ strokes: input.strokes, updatedAt: new Date().toISOString() })
    .where(eq(drawings.id, input.id))
    .run();
  return getDrawing(input.id);
}

export function deleteDrawing(id: string): void {
  getDb().delete(drawings).where(eq(drawings.id, id)).run();
}

/**
 * Drawings nothing points at any more.
 *
 * Same reasoning as the media purge: this is only ever run from the explicit "reclaim
 * space" action, never automatically on delete, because deletes are undoable.
 */
export function deleteUnusedDrawings(referencedIds: Set<string>): number {
  const all = getDb().select({ id: drawings.id }).from(drawings).all();
  let removed = 0;
  for (const row of all) {
    if (referencedIds.has(row.id)) continue;
    deleteDrawing(row.id);
    removed++;
  }
  return removed;
}
