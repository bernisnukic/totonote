import { randomUUID } from 'crypto';
import { eq, max } from 'drizzle-orm';
import { getDb } from '../connection';
import { workspaces } from '../schema';
import type { Workspace } from '../../../shared/domain-types';

/**
 * Workspaces are the top of the tree: workspace → document → section, with the whole
 * category/tag taxonomy scoped to one workspace too. Two worlds can each have their own
 * CHARACTERS tree without seeing each other's.
 */

export function listWorkspaces(): Workspace[] {
  return getDb().select().from(workspaces).orderBy(workspaces.sortOrder).all();
}

export function getWorkspace(id: string): Workspace | null {
  return getDb().select().from(workspaces).where(eq(workspaces.id, id)).get() ?? null;
}

export function createWorkspace(name: string): Workspace {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Workspace name is required');

  const db = getDb();
  const existing = db.select().from(workspaces).all();
  if (existing.some(w => w.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`A workspace called "${trimmed}" already exists`);
  }

  const maxRow = db.select({ max: max(workspaces.sortOrder) }).from(workspaces).get();
  const workspace: Workspace = {
    id: `ws-${randomUUID()}`,
    name: trimmed,
    sortOrder: (maxRow?.max ?? 0) + 1,
    createdAt: new Date().toISOString(),
  };
  db.insert(workspaces).values(workspace).run();
  return workspace;
}

export function renameWorkspace(id: string, name: string): Workspace {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Workspace name is required');
  const db = getDb();
  const clash = db
    .select()
    .from(workspaces)
    .all()
    .find(w => w.id !== id && w.name.toLowerCase() === trimmed.toLowerCase());
  if (clash) throw new Error(`A workspace called "${trimmed}" already exists`);

  db.update(workspaces).set({ name: trimmed }).where(eq(workspaces.id, id)).run();
  return db.select().from(workspaces).where(eq(workspaces.id, id)).get()!;
}

/**
 * Delete a workspace and everything in it. Refuses to remove the last one — the app has
 * nowhere to put documents without at least one workspace. Returns the workspace that
 * should become active.
 */
export function deleteWorkspace(id: string): { remainingId: string } {
  const db = getDb();
  const all = listWorkspaces();
  if (all.length <= 1) {
    throw new Error('You need at least one workspace');
  }
  db.delete(workspaces).where(eq(workspaces.id, id)).run();
  const remaining = listWorkspaces();
  return { remainingId: remaining[0].id };
}
