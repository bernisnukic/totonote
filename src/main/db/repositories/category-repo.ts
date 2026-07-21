import { randomUUID } from 'crypto';
import { eq, inArray, isNull, max } from 'drizzle-orm';
import { getDb } from '../connection';
import { categories, browseCategories } from '../schema';
import { getCategoryRule } from './category-rule-repo';
import { captureCategory } from './undo-repo';
import { parseRuleTemplate, type RuleNode } from '../../../shared/category-rule';
import type {
  DeletionSnapshot,
  Category,
  BrowseCategory,
  CreateCategoryInput,
  CreateCategoryResult,
  ApplyRuleResult,
  BulkAddSubcategoryInput,
  BulkAddSubcategoryResult,
} from '../../../shared/domain-types';

/** Categories in one workspace, or all of them when no workspace is given. */
export function listCategories(workspaceId?: string): Category[] {
  const q = getDb().select().from(categories).orderBy(categories.sortOrder);
  return (workspaceId ? q.where(eq(categories.workspaceId, workspaceId)) : q).all();
}

function getCategory(id: string): Category | null {
  return getDb().select().from(categories).where(eq(categories.id, id)).get() ?? null;
}

/**
 * Direct children of a category. Root-level lookups (`parentId === null`) must also be
 * scoped by workspace, or one world's roots collide with another's.
 */
function childrenOf(parentId: string | null, workspaceId?: string): Category[] {
  const db = getDb();
  const rows = db
    .select()
    .from(categories)
    .where(parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId))
    .orderBy(categories.sortOrder)
    .all();
  return workspaceId ? rows.filter(c => c.workspaceId === workspaceId) : rows;
}

/**
 * Names are compared case-insensitively among siblings. The unique indexes in the
 * schema are the exact-match backstop; this is the friendlier rule that stops
 * "History" and "HISTORY" becoming two sub-categories.
 */
function findSibling(siblings: Category[], name: string): Category | undefined {
  const needle = name.trim().toLowerCase();
  return siblings.find(c => c.name.toLowerCase() === needle);
}

/** Hands out sort orders from one starting point, rather than re-querying max() per insert. */
function makeSortOrderAllocator(): () => number {
  const maxRow = getDb().select({ max: max(categories.sortOrder) }).from(categories).get();
  let next = (maxRow?.max ?? 0) + 1;
  return () => next++;
}

function insertCategory(
  name: string,
  parentId: string | null,
  sortOrder: number,
  workspaceId: string,
): Category {
  const category: Category = { id: `cat-${randomUUID()}`, workspaceId, name, parentId, sortOrder };
  getDb().insert(categories).values(category).run();
  return category;
}

/**
 * Merge a parsed rule tree into `parentId`, creating only what is missing.
 *
 * Idempotent by design: an existing sub-category with a matching name is reused and
 * recursed into rather than duplicated, which is what makes "apply to existing
 * sub-categories" safe to run repeatedly.
 */
function applyTemplateUnder(
  parentId: string,
  nodes: RuleNode[],
  nextSortOrder: () => number,
  created: Category[],
  workspaceId: string,
): void {
  if (nodes.length === 0) return;
  const existing = childrenOf(parentId);

  for (const node of nodes) {
    let child = findSibling(existing, node.name);
    if (!child) {
      child = insertCategory(node.name, parentId, nextSortOrder(), workspaceId);
      existing.push(child);
      created.push(child);
    }
    applyTemplateUnder(child.id, node.children, nextSortOrder, created, workspaceId);
  }
}

function ruleNodesFor(categoryId: string | null | undefined): RuleNode[] {
  if (!categoryId) return [];
  const rule = getCategoryRule(categoryId);
  return rule ? parseRuleTemplate(rule.template) : [];
}

export function createCategory(input: CreateCategoryInput): CreateCategoryResult {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required');

  const parentId = input.parentId ?? null;
  const parent = parentId ? getCategory(parentId) : null;
  if (parentId && !parent) {
    throw new Error(`Parent category not found: ${parentId}`);
  }

  // A child always lives in its parent's workspace; a root needs to be told which.
  const workspaceId = parent?.workspaceId ?? input.workspaceId;
  if (!workspaceId) throw new Error('A root category needs a workspace');

  const duplicate = findSibling(childrenOf(parentId, workspaceId), name);
  if (duplicate) {
    throw new Error(
      parentId
        ? `A sub-category named "${duplicate.name}" already exists here`
        : `A category named "${duplicate.name}" already exists`,
    );
  }

  return getDb().transaction(() => {
    const nextSortOrder = makeSortOrderAllocator();
    const category = insertCategory(name, parentId, nextSortOrder(), workspaceId);

    const descendants: Category[] = [];
    if (input.applyRule) {
      applyTemplateUnder(category.id, ruleNodesFor(parentId), nextSortOrder, descendants, workspaceId);
    }

    return { category, descendants };
  });
}

/**
 * Stamp a category's rule onto the sub-categories it already has — the "retroactive"
 * option. Only missing nodes are created, so nothing is duplicated or reordered.
 */
export function applyRuleToExistingChildren(categoryId: string): ApplyRuleResult {
  const nodes = ruleNodesFor(categoryId);
  if (nodes.length === 0) return { created: [], childrenAffected: 0 };
  const owner = getCategory(categoryId);
  if (!owner) return { created: [], childrenAffected: 0 };

  return getDb().transaction(() => {
    const nextSortOrder = makeSortOrderAllocator();
    const created: Category[] = [];
    let childrenAffected = 0;

    for (const child of childrenOf(categoryId)) {
      const before = created.length;
      applyTemplateUnder(child.id, nodes, nextSortOrder, created, owner.workspaceId);
      if (created.length > before) childrenAffected++;
    }

    return { created, childrenAffected };
  });
}

/** Add one sub-category to each of several categories at once. */
export function bulkAddSubcategory(input: BulkAddSubcategoryInput): BulkAddSubcategoryResult {
  const name = input.name.trim();
  if (!name) throw new Error('Sub-category name is required');

  return getDb().transaction(() => {
    const nextSortOrder = makeSortOrderAllocator();
    const created: Category[] = [];
    const skipped: BulkAddSubcategoryResult['skipped'] = [];

    for (const parentId of input.parentIds) {
      const parent = getCategory(parentId);
      if (!parent) continue;

      if (findSibling(childrenOf(parentId), name)) {
        skipped.push({ parentId, parentName: parent.name });
        continue;
      }

      const child = insertCategory(name, parentId, nextSortOrder(), parent.workspaceId);
      created.push(child);

      if (input.applyRule) {
        applyTemplateUnder(child.id, ruleNodesFor(parentId), nextSortOrder, created, parent.workspaceId);
      }
    }

    return { created, skipped };
  });
}

export function updateCategory(
  id: string,
  updates: { name?: string; parentId?: string | null },
): Category {
  const db = getDb();
  const patch: Partial<Category> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.parentId !== undefined) patch.parentId = updates.parentId;
  if (Object.keys(patch).length > 0) {
    db.update(categories).set(patch).where(eq(categories.id, id)).run();
  }
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}

/** Every descendant id of `id`, plus `id` itself. */
export function collectCategoryIds(id: string): string[] {
  const all = listCategories();
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    for (const c of all) {
      if (c.parentId === ids[i]) ids.push(c.id);
    }
  }
  return ids;
}

/**
 * Delete a category and everything nested under it.
 *
 * The schema's `parent_id` foreign key is ON DELETE SET NULL, so deleting a parent on
 * its own would quietly promote its children to the root instead of removing them —
 * which is neither what the confirmation dialog promises nor what a nested rule tree
 * makes sensible. Returns every id removed so the renderer can prune its store.
 */
export function deleteCategory(id: string): { removedIds: string[]; snapshot: DeletionSnapshot } {
  const ids = collectCategoryIds(id);
  const snapshot = captureCategory(id, ids);
  getDb().transaction(() => {
    getDb().delete(categories).where(inArray(categories.id, ids)).run();
  });
  return { removedIds: ids, snapshot };
}

export function listBrowseCategories(): BrowseCategory[] {
  return getDb().select().from(browseCategories).orderBy(browseCategories.sortOrder).all();
}
