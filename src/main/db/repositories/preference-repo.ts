import { getDb } from '../connection';
import type { DocumentTagWithDetails } from '../../../shared/domain-types';

// Preferences
export function getPreference(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM preferences WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setPreference(key: string, value: string): void {
  getDb().prepare(
    'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  ).run(key, value, value);
}

// Document Tags
interface DocumentTagRow {
  document_id: string;
  tag_id: string;
  category_id: string;
  tag_name: string;
  tag_color: string;
  category_name: string;
}

export function listDocumentTags(documentId: string): DocumentTagWithDetails[] {
  const rows = getDb().prepare(`
    SELECT dt.document_id, dt.tag_id, dt.category_id,
           t.name as tag_name, t.color as tag_color,
           c.name as category_name
    FROM document_tags dt
    JOIN tags t ON t.id = dt.tag_id
    JOIN categories c ON c.id = dt.category_id
    WHERE dt.document_id = ?
    ORDER BY c.sort_order, t.name
  `).all(documentId) as DocumentTagRow[];

  return rows.map(row => ({
    documentId: row.document_id,
    tagId: row.tag_id,
    categoryId: row.category_id,
    tagName: row.tag_name,
    tagColor: row.tag_color,
    categoryName: row.category_name,
  }));
}

export function addDocumentTag(documentId: string, tagId: string, categoryId: string): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO document_tags (document_id, tag_id, category_id) VALUES (?, ?, ?)'
  ).run(documentId, tagId, categoryId);
}

export function removeDocumentTag(documentId: string, tagId: string): void {
  getDb().prepare(
    'DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?'
  ).run(documentId, tagId);
}
