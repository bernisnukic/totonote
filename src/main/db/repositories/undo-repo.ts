import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../connection';
import {
  documents,
  sections,
  categories,
  categoryRules,
  tags,
  annotations,
  documentTags,
  sectionTags,
} from '../schema';
import type { DeletionSnapshot } from '../../../shared/domain-types';

/**
 * Undo for destructive actions, done by capture-and-restore.
 *
 * Deleting anything in this app cascades — a category takes its sub-categories, their
 * tags, and every highlight using them — and none of it was recoverable. Rather than
 * building an inverse operation per action, each delete first captures every row it is
 * about to destroy; undo re-inserts them verbatim.
 *
 * Snapshots cross IPC as plain JSON, so they hold rows, not objects with behaviour.
 * They are only valid immediately after the delete: the toast expires quickly, and a
 * restore whose parents have since gone will fail its foreign keys rather than
 * resurrect something half-broken.
 */

function emptySnapshot(kind: DeletionSnapshot['kind'], label: string): DeletionSnapshot {
  return {
    kind,
    label,
    rows: {
      categories: [],
      categoryRules: [],
      documents: [],
      sections: [],
      tags: [],
      annotations: [],
      documentTags: [],
      sectionTags: [],
    },
  };
}

/** Everything hanging off a set of sections. */
function captureBySections(snapshot: DeletionSnapshot, sectionIds: string[]): void {
  if (sectionIds.length === 0) return;
  const db = getDb();
  snapshot.rows.annotations.push(
    ...db.select().from(annotations).where(inArray(annotations.sectionId, sectionIds)).all(),
  );
  snapshot.rows.sectionTags.push(
    ...db.select().from(sectionTags).where(inArray(sectionTags.sectionId, sectionIds)).all(),
  );
}

/** Everything hanging off a set of tags. */
function captureByTags(snapshot: DeletionSnapshot, tagIds: string[]): void {
  if (tagIds.length === 0) return;
  const db = getDb();
  const seen = new Set(snapshot.rows.annotations.map(a => a.id));
  for (const row of db.select().from(annotations).where(inArray(annotations.tagId, tagIds)).all()) {
    if (!seen.has(row.id)) snapshot.rows.annotations.push(row);
  }
  snapshot.rows.documentTags.push(
    ...db.select().from(documentTags).where(inArray(documentTags.tagId, tagIds)).all(),
  );
  const seenSectionTags = new Set(
    snapshot.rows.sectionTags.map(st => `${st.sectionId}:${st.tagId}`),
  );
  for (const row of db.select().from(sectionTags).where(inArray(sectionTags.tagId, tagIds)).all()) {
    if (!seenSectionTags.has(`${row.sectionId}:${row.tagId}`)) snapshot.rows.sectionTags.push(row);
  }
}

export function captureDocument(id: string): DeletionSnapshot {
  const db = getDb();
  const doc = db.select().from(documents).where(eq(documents.id, id)).get();
  const snapshot = emptySnapshot('document', doc?.title ?? 'document');
  if (!doc) return snapshot;

  snapshot.rows.documents.push(doc);
  const docSections = db.select().from(sections).where(eq(sections.documentId, id)).all();
  snapshot.rows.sections.push(...docSections);
  captureBySections(snapshot, docSections.map(s => s.id));
  snapshot.rows.documentTags.push(
    ...db.select().from(documentTags).where(eq(documentTags.documentId, id)).all(),
  );
  return snapshot;
}

export function captureSection(id: string): DeletionSnapshot {
  const db = getDb();
  const section = db.select().from(sections).where(eq(sections.id, id)).get();
  const snapshot = emptySnapshot('section', section?.title ?? 'section');
  if (!section) return snapshot;

  snapshot.rows.sections.push(section);
  captureBySections(snapshot, [id]);
  return snapshot;
}

export function captureTag(id: string): DeletionSnapshot {
  const db = getDb();
  const tag = db.select().from(tags).where(eq(tags.id, id)).get();
  const snapshot = emptySnapshot('tag', tag?.name ?? 'tag');
  if (!tag) return snapshot;

  snapshot.rows.tags.push(tag);
  captureByTags(snapshot, [id]);
  return snapshot;
}

/** A category plus its descendants, their rules, their tags, and everything using them. */
export function captureCategory(id: string, categoryIds: string[]): DeletionSnapshot {
  const db = getDb();
  const category = db.select().from(categories).where(eq(categories.id, id)).get();
  const snapshot = emptySnapshot('category', category?.name ?? 'category');
  if (!category) return snapshot;

  // collectCategoryIds returns parents before children, which is the order restore needs.
  snapshot.rows.categories.push(
    ...db.select().from(categories).where(inArray(categories.id, categoryIds)).all()
      .sort((a, b) => categoryIds.indexOf(a.id) - categoryIds.indexOf(b.id)),
  );
  snapshot.rows.categoryRules.push(
    ...db.select().from(categoryRules).where(inArray(categoryRules.categoryId, categoryIds)).all(),
  );
  const doomedTags = db.select().from(tags).where(inArray(tags.categoryId, categoryIds)).all();
  snapshot.rows.tags.push(...doomedTags);
  captureByTags(snapshot, doomedTags.map(t => t.id));

  // Annotations *filed* under these categories survive the delete (ON DELETE SET NULL),
  // so they are not captured here — but their filing is lost, so record it to put back.
  snapshot.rows.annotations.push(
    ...db.select().from(annotations).where(inArray(annotations.categoryId, categoryIds)).all()
      .filter(a => !snapshot.rows.annotations.some(existing => existing.id === a.id)),
  );
  return snapshot;
}

/**
 * Put a snapshot back. Insert order follows the foreign keys: categories before the
 * tags that live in them, documents before sections, both before annotations.
 *
 * Rows that still exist are left alone — annotations filed under a deleted category
 * were only unfiled, not removed, so re-inserting would collide. Their filing is
 * restored by an update instead.
 */
export function restoreSnapshot(snapshot: DeletionSnapshot): void {
  const db = getDb();
  const { rows } = snapshot;

  db.transaction(() => {
    for (const row of rows.categories) {
      db.insert(categories).values(row).onConflictDoNothing().run();
    }
    for (const row of rows.categoryRules) {
      db.insert(categoryRules).values(row).onConflictDoNothing().run();
    }
    for (const row of rows.documents) {
      db.insert(documents).values(row).onConflictDoNothing().run();
    }
    for (const row of rows.sections) {
      db.insert(sections).values(row).onConflictDoNothing().run();
    }
    for (const row of rows.tags) {
      db.insert(tags).values(row).onConflictDoNothing().run();
    }
    for (const row of rows.annotations) {
      const existing = db.select().from(annotations).where(eq(annotations.id, row.id)).get();
      if (existing) {
        // Survived the delete but was unfiled — put the filing back.
        db.update(annotations)
          .set({ categoryId: row.categoryId, placementOrder: row.placementOrder })
          .where(eq(annotations.id, row.id))
          .run();
      } else {
        db.insert(annotations).values(row).run();
      }
    }
    for (const row of rows.documentTags) {
      db.insert(documentTags).values(row).onConflictDoNothing().run();
    }
    for (const row of rows.sectionTags) {
      db.insert(sectionTags).values(row).onConflictDoNothing().run();
    }
  });
}
