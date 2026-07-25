import { v4 as uuid } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../connection';
import { indexSection } from './search-repo';
import { captureDocument } from './undo-repo';
import { documentLinkIdsInContent } from '../../../shared/doc-links';
import type { Backlink } from '../../../shared/domain-types';
import type { DeletionSnapshot } from '../../../shared/domain-types';
import { documents, sections } from '../schema';
import type { Document, CreateDocumentInput, UpdateDocumentInput } from '../../../shared/domain-types';

/** Documents in one workspace, or all of them when no workspace is given. */
export function listDocuments(workspaceId?: string): Document[] {
  const q = getDb().select().from(documents).orderBy(desc(documents.updatedAt));
  return (workspaceId ? q.where(eq(documents.workspaceId, workspaceId)) : q).all();
}

export function getDocument(id: string): Document | null {
  const row = getDb().select().from(documents).where(eq(documents.id, id)).get();
  return row ?? null;
}

export function createDocument(input: CreateDocumentInput): Document {
  const now = new Date().toISOString();
  const doc: Document = {
    id: uuid(),
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description ?? '',
    sectionLabel: input.sectionLabel ?? 'Section',
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(documents).values(doc).run();
  return doc;
}

export function updateDocument(input: UpdateDocumentInput): Document {
  const existing = getDocument(input.id);
  if (!existing) throw new Error(`Document not found: ${input.id}`);

  const updated: Document = {
    ...existing,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    sectionLabel: input.sectionLabel ?? existing.sectionLabel,
    updatedAt: new Date().toISOString(),
  };
  getDb().update(documents).set(updated).where(eq(documents.id, input.id)).run();

  // The search index stores each section's document title alongside its text, so renaming
  // a document leaves every one of its rows pointing at the old name — searching the new
  // name would find nothing and the old name would still match.
  if (input.title !== undefined && input.title !== existing.title) {
    reindexDocumentSections(input.id);
  }
  return updated;
}

/** Re-index every section of a document, after something denormalised into the index changed. */
function reindexDocumentSections(documentId: string): void {
  const rows = getDb()
    .select({ id: sections.id })
    .from(sections)
    .where(eq(sections.documentId, documentId))
    .all();
  for (const row of rows) indexSection(row.id);
}

export function deleteDocument(id: string): DeletionSnapshot {
  const snapshot = captureDocument(id);
  getDb().delete(documents).where(eq(documents.id, id)).run();
  return snapshot;
}

/**
 * Which documents link to this one, and how many times.
 *
 * Links live inside each section's stored TipTap JSON rather than in a table of their own,
 * so this reads the sections and counts. A dedicated link table would be faster, but it
 * would also be a second copy of the truth to keep in step through every edit, undo and
 * restore — the exact class of bug that has bitten the search index. Worlds here hold
 * hundreds of sections, not millions, and this runs when a document is opened.
 */
export function listBacklinks(documentId: string): Backlink[] {
  const rows = getDb()
    .select({
      documentId: documents.id,
      documentTitle: documents.title,
      sectionId: sections.id,
      sectionTitle: sections.title,
      content: sections.content,
    })
    .from(sections)
    .innerJoin(documents, eq(sections.documentId, documents.id))
    .all();

  const byDocument = new Map<string, Backlink>();
  for (const row of rows) {
    // A document linking to itself is a note-to-self, not a connection worth listing.
    if (row.documentId === documentId) continue;
    const hits = documentLinkIdsInContent(row.content).filter(id => id === documentId).length;
    if (hits === 0) continue;

    const existing = byDocument.get(row.documentId);
    if (existing) {
      existing.count += hits;
      existing.sections.push({ sectionId: row.sectionId, sectionTitle: row.sectionTitle });
    } else {
      byDocument.set(row.documentId, {
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        count: hits,
        sections: [{ sectionId: row.sectionId, sectionTitle: row.sectionTitle }],
      });
    }
  }

  return [...byDocument.values()].sort((a, b) => b.count - a.count || a.documentTitle.localeCompare(b.documentTitle));
}
