import { v4 as uuid } from 'uuid';
import { getDb } from '../connection';
import type { Section, CreateSectionInput, UpdateSectionInput } from '../../../shared/domain-types';

interface SectionRow {
  id: string;
  document_id: string;
  title: string;
  abbreviation: string;
  sort_order: number;
  content: string;
  created_at: string;
  updated_at: string;
}

function rowToSection(row: SectionRow): Section {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    abbreviation: row.abbreviation,
    sortOrder: row.sort_order,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSections(documentId: string): Section[] {
  const rows = getDb().prepare(
    'SELECT * FROM sections WHERE document_id = ? ORDER BY sort_order'
  ).all(documentId) as SectionRow[];
  return rows.map(rowToSection);
}

export function getSection(id: string): Section | null {
  const row = getDb().prepare('SELECT * FROM sections WHERE id = ?').get(id) as SectionRow | undefined;
  return row ? rowToSection(row) : null;
}

export function createSection(input: CreateSectionInput): Section {
  const id = uuid();
  const now = new Date().toISOString();
  getDb().prepare(
    'INSERT INTO sections (id, document_id, title, abbreviation, sort_order, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.documentId, input.title, input.abbreviation, input.sortOrder, input.content || '', now, now);
  return getSection(id)!;
}

export function updateSection(input: UpdateSectionInput): Section {
  const existing = getSection(input.id);
  if (!existing) throw new Error(`Section not found: ${input.id}`);

  const title = input.title ?? existing.title;
  const abbreviation = input.abbreviation ?? existing.abbreviation;
  const sortOrder = input.sortOrder ?? existing.sortOrder;
  const content = input.content ?? existing.content;
  const now = new Date().toISOString();

  getDb().prepare(
    'UPDATE sections SET title = ?, abbreviation = ?, sort_order = ?, content = ?, updated_at = ? WHERE id = ?'
  ).run(title, abbreviation, sortOrder, content, now, input.id);

  return getSection(input.id)!;
}

export function deleteSection(id: string): void {
  getDb().prepare('DELETE FROM sections WHERE id = ?').run(id);
}

export function reorderSections(documentId: string, orderedIds: string[]): void {
  const update = getDb().prepare('UPDATE sections SET sort_order = ? WHERE id = ? AND document_id = ?');
  const transaction = getDb().transaction(() => {
    orderedIds.forEach((id, index) => {
      update.run(index, id, documentId);
    });
  });
  transaction();
}
