import { v4 as uuid } from 'uuid';
import { getDb } from '../connection';
import type { Annotation, CreateAnnotationInput, UpdateAnnotationInput, PositionUpdate } from '../../../shared/domain-types';

interface AnnotationRow {
  id: string;
  section_id: string;
  tag_id: string;
  from_pos: number;
  to_pos: number;
  note: string;
  created_at: string;
}

function rowToAnnotation(row: AnnotationRow): Annotation {
  return {
    id: row.id,
    sectionId: row.section_id,
    tagId: row.tag_id,
    fromPos: row.from_pos,
    toPos: row.to_pos,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function listAnnotations(sectionId: string): Annotation[] {
  const rows = getDb().prepare(
    'SELECT * FROM annotations WHERE section_id = ? ORDER BY from_pos'
  ).all(sectionId) as AnnotationRow[];
  return rows.map(rowToAnnotation);
}

export function listAnnotationsByDocument(documentId: string): Annotation[] {
  const rows = getDb().prepare(
    `SELECT a.* FROM annotations a
     JOIN sections s ON s.id = a.section_id
     WHERE s.document_id = ?
     ORDER BY a.from_pos`
  ).all(documentId) as AnnotationRow[];
  return rows.map(rowToAnnotation);
}

export function createAnnotation(input: CreateAnnotationInput): Annotation {
  const id = uuid();
  const now = new Date().toISOString();
  getDb().prepare(
    'INSERT INTO annotations (id, section_id, tag_id, from_pos, to_pos, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.sectionId, input.tagId, input.fromPos, input.toPos, input.note || '', now);
  return { id, sectionId: input.sectionId, tagId: input.tagId, fromPos: input.fromPos, toPos: input.toPos, note: input.note || '', createdAt: now };
}

export function updateAnnotation(input: UpdateAnnotationInput): Annotation {
  const row = getDb().prepare('SELECT * FROM annotations WHERE id = ?').get(input.id) as AnnotationRow | undefined;
  if (!row) throw new Error(`Annotation not found: ${input.id}`);

  const fromPos = input.fromPos ?? row.from_pos;
  const toPos = input.toPos ?? row.to_pos;
  const note = input.note ?? row.note;
  const tagId = input.tagId ?? row.tag_id;

  getDb().prepare(
    'UPDATE annotations SET from_pos = ?, to_pos = ?, note = ?, tag_id = ? WHERE id = ?'
  ).run(fromPos, toPos, note, tagId, input.id);

  return rowToAnnotation({ ...row, from_pos: fromPos, to_pos: toPos, note, tag_id: tagId });
}

export function deleteAnnotation(id: string): void {
  getDb().prepare('DELETE FROM annotations WHERE id = ?').run(id);
}

export function batchUpdatePositions(updates: PositionUpdate[]): void {
  const stmt = getDb().prepare('UPDATE annotations SET from_pos = ?, to_pos = ? WHERE id = ?');
  const transaction = getDb().transaction(() => {
    for (const update of updates) {
      stmt.run(update.fromPos, update.toPos, update.id);
    }
  });
  transaction();
}
