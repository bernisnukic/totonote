import { v4 as uuid } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../connection';
import { captureDocument } from './undo-repo';
import type { DeletionSnapshot } from '../../../shared/domain-types';
import { documents } from '../schema';
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
  return updated;
}

export function deleteDocument(id: string): DeletionSnapshot {
  const snapshot = captureDocument(id);
  getDb().delete(documents).where(eq(documents.id, id)).run();
  return snapshot;
}
