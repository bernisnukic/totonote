import { eq, sql, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../connection';
import { media } from '../schema';
import type { MediaMeta, CreateMediaInput } from '../../../shared/domain-types';

/**
 * Embedded image bytes. Section content never holds the bytes themselves, only
 * `totonote://media/<id>` — see the `media` table comment in schema.ts.
 */

/** Store an image and return its metadata (the bytes are not echoed back). */
export function createMedia(input: CreateMediaInput): MediaMeta {
  const id = randomUUID();
  const data = Buffer.from(input.data);
  getDb()
    .insert(media)
    .values({
      id,
      mimeType: input.mimeType,
      width: input.width,
      height: input.height,
      byteSize: data.byteLength,
      data,
    })
    .run();
  return { id, mimeType: input.mimeType, width: input.width, height: input.height, byteSize: data.byteLength };
}

/** Everything the protocol handler needs to serve one image. */
export function getMediaBytes(id: string): { mimeType: string; data: Buffer } | null {
  const row = getDb()
    .select({ mimeType: media.mimeType, data: media.data })
    .from(media)
    .where(eq(media.id, id))
    .get();
  if (!row) return null;
  return { mimeType: row.mimeType, data: Buffer.from(row.data as Buffer) };
}

/** Record the text read out of a picture ('' means "looked, found nothing"). */
export function setMediaOcrText(id: string, text: string): void {
  getDb().update(media).set({ ocrText: text }).where(eq(media.id, id)).run();
}

/** Images that have never been looked at, for backfilling after an upgrade. */
export function mediaWithoutOcr(limit = 50): Array<{ id: string; data: Buffer }> {
  const rows = getDb()
    .select({ id: media.id, data: media.data })
    .from(media)
    .where(isNull(media.ocrText))
    .limit(limit)
    .all();
  return rows.map(r => ({ id: r.id, data: Buffer.from(r.data as Buffer) }));
}

/** Metadata only — used by the renderer to size a node without fetching the bytes. */
export function getMediaMeta(id: string): MediaMeta | null {
  const row = getDb()
    .select({
      id: media.id,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      byteSize: media.byteSize,
    })
    .from(media)
    .where(eq(media.id, id))
    .get();
  return row ?? null;
}

/** Total bytes held by embedded images, for the storage line in Settings. */
export function mediaUsage(): { count: number; totalBytes: number } {
  const row = getDb()
    .select({
      count: sql<number>`count(*)`,
      totalBytes: sql<number>`coalesce(sum(${media.byteSize}), 0)`,
    })
    .from(media)
    .get();
  return { count: row?.count ?? 0, totalBytes: row?.totalBytes ?? 0 };
}

/**
 * Delete images nothing refers to any more.
 *
 * Deliberately *not* run when a section is deleted: those deletions are undoable, and
 * purging the images of a restorable section would quietly break it. This is the explicit
 * "reclaim space" action instead, and it scans live section content for the ids in use.
 */
export function deleteUnusedMedia(referencedIds: Set<string>): number {
  const all = getDb().select({ id: media.id }).from(media).all();
  let removed = 0;
  for (const row of all) {
    if (referencedIds.has(row.id)) continue;
    getDb().delete(media).where(eq(media.id, row.id)).run();
    removed++;
  }
  return removed;
}
