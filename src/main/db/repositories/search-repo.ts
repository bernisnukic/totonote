import { sql } from 'drizzle-orm';
import { getDb } from '../connection';
import { plainTextFromContent } from '../../../shared/prosemirror-text';
import { mediaIdsInContent } from '../../../shared/media-refs';
import type { SearchHit } from '../../../shared/domain-types';

/**
 * Full-text search over everything you've written.
 *
 * The index is **derived data**, so it deliberately lives outside the migration chain: it's
 * created with `IF NOT EXISTS` at startup and can be dropped and rebuilt at any time. A
 * change here can never put a user's actual content at risk.
 *
 * A section's indexed body is its own text **plus any text read out of the images it
 * embeds** (media.ocr_text) — so a label on a map is findable from the search box even
 * though it only exists as pixels.
 */

/** Identifier, so it goes through sql.raw; every *value* is still bound as a parameter. */
const FTS = sql.raw('section_search');

/**
 * The index definition, exported so the test database can create the same thing.
 *
 * It isn't part of the migration chain (it's derived data), which means a test database
 * built straight from the migrations wouldn't have it — and every section write would then
 * fail on the re-index. Sharing one definition keeps the two honest.
 */
export const SEARCH_INDEX_DDL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS section_search USING fts5(
    section_id UNINDEXED,
    document_id UNINDEXED,
    workspace_id UNINDEXED,
    document_title,
    section_title,
    body,
    tokenize = 'unicode61 remove_diacritics 2'
  )
`;

/** Create the index if it isn't there. Safe on every launch. */
export function ensureSearchIndex(): void {
  getDb().run(sql.raw(SEARCH_INDEX_DDL));
}

/** True when the index has never been populated, so first launch can backfill it. */
export function isSearchIndexEmpty(): boolean {
  const rows = getDb().all(sql`SELECT count(*) AS n FROM ${FTS}`) as Array<{ n: number }>;
  return (rows[0]?.n ?? 0) === 0;
}

/** Text read out of the images a section embeds, so pictures are searchable too. */
function imageTextFor(content: string): string {
  const ids = mediaIdsInContent(content);
  if (ids.length === 0) return '';
  const list = sql.join(
    ids.map(id => sql`${id}`),
    sql`, `,
  );
  const rows = getDb().all(
    sql`SELECT ocr_text AS ocrText FROM media WHERE id IN (${list}) AND ocr_text IS NOT NULL`,
  ) as Array<{ ocrText: string | null }>;
  return rows.map(r => r.ocrText ?? '').filter(Boolean).join('\n');
}

/** Re-index one section. Called whenever its content is written. */
export function indexSection(sectionId: string): void {
  const db = getDb();
  db.run(sql`DELETE FROM ${FTS} WHERE section_id = ${sectionId}`);

  const rows = db.all(sql`
    SELECT s.id AS sectionId, s.document_id AS documentId, d.workspace_id AS workspaceId,
           d.title AS documentTitle, s.title AS sectionTitle, s.content AS content
    FROM sections s JOIN documents d ON d.id = s.document_id
    WHERE s.id = ${sectionId}
  `) as Array<{
    sectionId: string;
    documentId: string;
    workspaceId: string;
    documentTitle: string;
    sectionTitle: string;
    content: string;
  }>;
  const row = rows[0];
  if (!row) return;

  const body = [plainTextFromContent(row.content), imageTextFor(row.content)]
    .filter(Boolean)
    .join('\n');

  db.run(sql`
    INSERT INTO ${FTS} (section_id, document_id, workspace_id, document_title, section_title, body)
    VALUES (${row.sectionId}, ${row.documentId}, ${row.workspaceId}, ${row.documentTitle}, ${row.sectionTitle}, ${body})
  `);
}

/** Drop a deleted section from the index. */
export function removeSectionFromIndex(sectionId: string): void {
  getDb().run(sql`DELETE FROM ${FTS} WHERE section_id = ${sectionId}`);
}

/** Re-index every section embedding an image — used once its extracted text arrives. */
export function reindexSectionsUsingMedia(mediaId: string): void {
  const rows = getDb().all(
    sql`SELECT id FROM sections WHERE content LIKE ${`%${mediaId}%`}`,
  ) as Array<{ id: string }>;
  for (const row of rows) indexSection(row.id);
}

/** Rebuild from scratch — the backfill after an upgrade, and the repair if anything drifts. */
export function rebuildSearchIndex(): void {
  const db = getDb();
  db.run(sql`DELETE FROM ${FTS}`);
  const rows = db.all(sql`SELECT id FROM sections`) as Array<{ id: string }>;
  for (const row of rows) indexSection(row.id);
}

/**
 * Turn what the user typed into an FTS5 query.
 *
 * People type words, not query syntax — a stray quote or `*` would otherwise raise an
 * error rather than search. Every word is quoted, and the last gets a prefix wildcard so
 * results narrow as you type.
 */
export function toMatchQuery(input: string): string {
  const words = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words.map((w, i) => (i === words.length - 1 ? `"${w}"*` : `"${w}"`)).join(' AND ');
}

export function searchWriting(query: string, workspaceId?: string, limit = 50): SearchHit[] {
  const match = toMatchQuery(query);
  if (!match) return [];

  const scope = workspaceId ? sql` AND workspace_id = ${workspaceId}` : sql``;
  try {
    return getDb().all(sql`
      SELECT section_id AS sectionId, document_id AS documentId,
             document_title AS documentTitle, section_title AS sectionTitle,
             snippet(${FTS}, 5, '[', ']', '…', 12) AS snippet
      FROM ${FTS}
      WHERE ${FTS} MATCH ${match}${scope}
      ORDER BY rank
      LIMIT ${limit}
    `) as SearchHit[];
  } catch {
    // A query FTS5 can't parse should find nothing, not break the search box.
    return [];
  }
}
