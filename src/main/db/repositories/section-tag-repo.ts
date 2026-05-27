import { getDb } from '../connection';
import type { SectionTagWithDetails } from '../../../shared/domain-types';

interface SectionTagRow {
  section_id: string;
  tag_id: string;
  tag_name: string;
  tag_color: string;
  category_id: string;
  category_name: string;
  created_at: string;
}

function rowToSectionTag(row: SectionTagRow): SectionTagWithDetails {
  return {
    sectionId: row.section_id,
    tagId: row.tag_id,
    tagName: row.tag_name,
    tagColor: row.tag_color,
    categoryId: row.category_id,
    categoryName: row.category_name,
    createdAt: row.created_at,
  };
}

const SELECT_WITH_DETAILS = `
  SELECT st.section_id, st.tag_id, st.created_at,
         t.name AS tag_name, t.color AS tag_color, t.category_id,
         c.name AS category_name
  FROM section_tags st
  JOIN tags t ON t.id = st.tag_id
  JOIN categories c ON c.id = t.category_id
`;

export function listSectionTags(sectionId: string): SectionTagWithDetails[] {
  const rows = getDb().prepare(
    `${SELECT_WITH_DETAILS} WHERE st.section_id = ? ORDER BY st.created_at`
  ).all(sectionId) as SectionTagRow[];
  return rows.map(rowToSectionTag);
}

export function listSectionTagsByDocument(documentId: string): SectionTagWithDetails[] {
  const rows = getDb().prepare(
    `${SELECT_WITH_DETAILS}
     JOIN sections s ON s.id = st.section_id
     WHERE s.document_id = ?
     ORDER BY st.created_at`
  ).all(documentId) as SectionTagRow[];
  return rows.map(rowToSectionTag);
}

export function addSectionTag(sectionId: string, tagId: string): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO section_tags (section_id, tag_id) VALUES (?, ?)'
  ).run(sectionId, tagId);
}

export function removeSectionTag(sectionId: string, tagId: string): void {
  getDb().prepare(
    'DELETE FROM section_tags WHERE section_id = ? AND tag_id = ?'
  ).run(sectionId, tagId);
}
