export interface Document {
  id: string;
  title: string;
  description: string;
  sectionLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  documentId: string;
  title: string;
  abbreviation: string;
  sortOrder: number;
  content: string; // TipTap JSON content
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface Tag {
  id: string;
  categoryId: string;
  name: string;
  color: string;
  description: string;
  createdAt: string;
}

export interface Annotation {
  id: string;
  sectionId: string;
  tagId: string;
  fromPos: number;
  toPos: number;
  note: string;
  createdAt: string;
}

export interface DocumentTag {
  documentId: string;
  tagId: string;
  categoryId: string;
}

export interface DocumentTagWithDetails extends DocumentTag {
  tagName: string;
  tagColor: string;
  categoryName: string;
}

export interface SectionTagWithDetails {
  sectionId: string;
  tagId: string;
  tagName: string;
  tagColor: string;
  categoryId: string;
  categoryName: string;
  createdAt: string;
}

export interface BrowseCategory {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface Preference {
  key: string;
  value: string;
}

// Input types for creation/update
export interface CreateDocumentInput {
  title: string;
  description?: string;
  sectionLabel?: string;
}

export interface UpdateDocumentInput {
  id: string;
  title?: string;
  description?: string;
  sectionLabel?: string;
}

export interface CreateSectionInput {
  documentId: string;
  title: string;
  abbreviation: string;
  sortOrder: number;
  content?: string;
}

export interface UpdateSectionInput {
  id: string;
  title?: string;
  abbreviation?: string;
  sortOrder?: number;
  content?: string;
}

export interface CreateTagInput {
  categoryId: string;
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagInput {
  id: string;
  name?: string;
  color?: string;
  description?: string;
  categoryId?: string;
}

export interface CreateAnnotationInput {
  sectionId: string;
  tagId: string;
  fromPos: number;
  toPos: number;
  note?: string;
}

export interface UpdateAnnotationInput {
  id: string;
  fromPos?: number;
  toPos?: number;
  note?: string;
  tagId?: string;
}

export interface PositionUpdate {
  id: string;
  fromPos: number;
  toPos: number;
}
