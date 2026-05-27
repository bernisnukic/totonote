import { v4 as uuid } from 'uuid';
import { getDb } from '../connection';
import type { Document, CreateDocumentInput, UpdateDocumentInput } from '../../../shared/domain-types';

interface DocumentRow {
  id: string;
  title: string;
  description: string;
  section_label: string;
  created_at: string;
  updated_at: string;
}

function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sectionLabel: row.section_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listDocuments(): Document[] {
  const rows = getDb().prepare('SELECT * FROM documents ORDER BY updated_at DESC').all() as DocumentRow[];
  return rows.map(rowToDocument);
}

export function getDocument(id: string): Document | null {
  const row = getDb().prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | undefined;
  return row ? rowToDocument(row) : null;
}

export function createDocument(input: CreateDocumentInput): Document {
  const id = uuid();
  const now = new Date().toISOString();
  getDb().prepare(
    'INSERT INTO documents (id, title, description, section_label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.title, input.description || '', input.sectionLabel || 'Section', now, now);
  return getDocument(id)!;
}

export function updateDocument(input: UpdateDocumentInput): Document {
  const existing = getDocument(input.id);
  if (!existing) throw new Error(`Document not found: ${input.id}`);

  const title = input.title ?? existing.title;
  const description = input.description ?? existing.description;
  const sectionLabel = input.sectionLabel ?? existing.sectionLabel;
  const now = new Date().toISOString();

  getDb().prepare(
    'UPDATE documents SET title = ?, description = ?, section_label = ?, updated_at = ? WHERE id = ?'
  ).run(title, description, sectionLabel, now, input.id);

  return getDocument(input.id)!;
}

export function deleteDocument(id: string): void {
  getDb().prepare('DELETE FROM documents WHERE id = ?').run(id);
}
