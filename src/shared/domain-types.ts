/** Top-level grouping — a "world". Documents and categories belong to exactly one. */
export interface Workspace {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface Document {
  workspaceId: string;
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
  workspaceId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

/**
 * The sub-category skeleton attached to a category. `template` is the raw indented
 * text as authored — see shared/category-rule.ts for the parser.
 */
export interface CategoryRule {
  categoryId: string;
  template: string;
  updatedAt: string;
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
  /**
   * Filing: the category this excerpt lives under in the wiki structure, or null for a
   * plain highlight. Independent of the tag — the tag says what the text is about, the
   * filing says which page section it belongs to.
   */
  categoryId: string | null;
  /** Manual position among the excerpts filed in the same category. */
  placementOrder: number;
  createdAt: string;
}

/** A filed annotation enriched with everything the compiled wiki views need. */
export interface AnnotationPlacement {
  id: string;
  tagId: string;
  tagName: string;
  tagColor: string;
  categoryId: string | null;
  placementOrder: number;
  fromPos: number;
  toPos: number;
  note: string;
  createdAt: string;
  sectionId: string;
  sectionTitle: string;
  sectionSortOrder: number;
  documentId: string;
  documentTitle: string;
  /** Text the annotation covers, computed from the stored section content. */
  excerpt: string;
}

/**
 * Everything a delete destroyed, captured so it can be put back. Rows are raw table
 * records; see main/db/repositories/undo-repo.ts.
 */
export interface DeletionSnapshot {
  kind: 'document' | 'section' | 'tag' | 'category';
  /** Human name of the thing deleted, for the undo toast. */
  label: string;
  rows: {
    categories: Category[];
    categoryRules: CategoryRule[];
    documents: Document[];
    sections: Section[];
    tags: Tag[];
    annotations: Annotation[];
    documentTags: DocumentTag[];
    sectionTags: { sectionId: string; tagId: string; createdAt: string }[];
  };
}

/** One tag→category filing relationship, aggregated for the graph view. */
export interface FilingEdge {
  tagId: string;
  categoryId: string;
  count: number;
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
  workspaceId: string;
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
  /** File the new annotation under this category straight away. */
  categoryId?: string | null;
}

export interface UpdateAnnotationInput {
  id: string;
  fromPos?: number;
  toPos?: number;
  note?: string;
  tagId?: string;
  /** Refile (or unfile with null). Filing appends to the end of the category's order. */
  categoryId?: string | null;
}

export interface PositionUpdate {
  id: string;
  fromPos: number;
  toPos: number;
}

export interface CreateCategoryInput {
  name: string;
  parentId?: string;
  /** Required for a root category; children inherit their parent's workspace. */
  workspaceId?: string;
  /** Stamp the parent's rule onto the new category. Ignored when the parent has none. */
  applyRule?: boolean;
}

/** A category plus everything a rule created underneath it. */
export interface CreateCategoryResult {
  category: Category;
  descendants: Category[];
}

export interface ApplyRuleResult {
  created: Category[];
  /** How many existing sub-categories gained at least one node. */
  childrenAffected: number;
}

export interface BulkAddSubcategoryInput {
  parentIds: string[];
  name: string;
  /** Also apply each selected category's own rule to the new child. */
  applyRule?: boolean;
}

export interface BulkAddSubcategoryResult {
  created: Category[];
  /** Categories that already had a child by that name, so were left alone. */
  skipped: { parentId: string; parentName: string }[];
}
