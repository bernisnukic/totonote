import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// SQLite timestamps are ISO strings (matches the existing schema and domain-types).
const isoNow = sql`(datetime('now'))`;

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  sectionLabel: text('section_label').notNull().default('Section'),
  createdAt: text('created_at').notNull().default(isoNow),
  updatedAt: text('updated_at').notNull().default(isoNow),
});

export const sections = sqliteTable(
  'sections',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    abbreviation: text('abbreviation').notNull(),
    sortOrder: integer('sort_order').notNull(),
    content: text('content').notNull().default(''),
    createdAt: text('created_at').notNull().default(isoNow),
    updatedAt: text('updated_at').notNull().default(isoNow),
  },
  t => ({
    documentIdx: index('idx_sections_document').on(t.documentId, t.sortOrder),
  }),
);

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    parentId: text('parent_id').references((): any => categories.id, { onDelete: 'set null' }),
  },
  t => ({
    // Names are unique per parent, not globally: CHARACTERS > GURA > HISTORY and
    // CHARACTERS > PEKORA > HISTORY must both be able to exist.
    parentNameUnique: uniqueIndex('idx_categories_parent_name').on(t.parentId, t.name),
    // SQLite treats NULLs as distinct in a unique index, so the index above does not
    // constrain root categories. This partial index covers them.
    rootNameUnique: uniqueIndex('idx_categories_root_name')
      .on(t.name)
      .where(sql`parent_id is null`),
  }),
);

// A category's rule: the sub-category skeleton stamped onto each new child of that
// category. Stored as the raw indented text the user authored so it round-trips into
// the editor unchanged; parseRuleTemplate() in shared/category-rule.ts turns it into a
// tree. Primary key on category_id makes this 1:1 with a category.
export const categoryRules = sqliteTable('category_rules', {
  categoryId: text('category_id')
    .primaryKey()
    .references(() => categories.id, { onDelete: 'cascade' }),
  template: text('template').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(isoNow),
});

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#48dbfb'),
    description: text('description').notNull().default(''),
    createdAt: text('created_at').notNull().default(isoNow),
  },
  t => ({
    categoryIdx: index('idx_tags_category').on(t.categoryId),
    nameCategoryUnique: uniqueIndex('idx_tags_name_category').on(t.name, t.categoryId),
  }),
);

export const annotations = sqliteTable(
  'annotations',
  {
    id: text('id').primaryKey(),
    sectionId: text('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    fromPos: integer('from_pos').notNull(),
    toPos: integer('to_pos').notNull(),
    note: text('note').notNull().default(''),
    createdAt: text('created_at').notNull().default(isoNow),
  },
  t => ({
    sectionIdx: index('idx_annotations_section').on(t.sectionId),
    tagIdx: index('idx_annotations_tag').on(t.tagId),
  }),
);

export const documentTags = sqliteTable(
  'document_tags',
  {
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
  },
  t => ({
    pk: primaryKey({ columns: [t.documentId, t.tagId] }),
  }),
);

export const sectionTags = sqliteTable(
  'section_tags',
  {
    sectionId: text('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull().default(isoNow),
  },
  t => ({
    pk: primaryKey({ columns: [t.sectionId, t.tagId] }),
    tagIdx: index('idx_section_tags_tag').on(t.tagId),
  }),
);

export const browseCategories = sqliteTable('browse_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id').references((): any => browseCategories.id),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const preferences = sqliteTable('preferences', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
