import type { StateCreator } from 'zustand';
import type { Workspace } from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';
import type { AppStore } from './index';

/** Remembers which world you were last in, across launches. */
export const ACTIVE_WORKSPACE_KEY = 'totonote-active-workspace';

export interface WorkspaceSlice {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  loadWorkspaces: () => Promise<void>;
  /** Switch worlds: closes any open document and reloads the taxonomy. */
  setActiveWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
}

function remember(id: string | null) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    /* storage disabled — the app just forgets between launches */
  }
}

function recall(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export const createWorkspaceSlice: StateCreator<AppStore, [], [], WorkspaceSlice> = (set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,

  loadWorkspaces: async () => {
    const workspaces = await invoke('workspace:list');
    // Fall back to the first workspace if the remembered one has since been deleted.
    const remembered = recall();
    const active =
      (remembered && workspaces.some(w => w.id === remembered) ? remembered : null) ??
      get().activeWorkspaceId ??
      workspaces[0]?.id ??
      null;
    remember(active);
    set({ workspaces, activeWorkspaceId: active });
  },

  setActiveWorkspace: async (id) => {
    if (get().activeWorkspaceId === id) return;
    remember(id);
    // Categories and documents belong to a workspace, so everything scoped has to go.
    set({
      activeWorkspaceId: id,
      activeDocumentId: null,
      activeDocument: null,
      sections: [],
      activeSectionId: null,
      focusedTagId: null,
      focusedCategoryId: null,
      documentAnnotations: [],
      sectionTags: [],
    });
    await Promise.all([get().loadDocuments(), get().loadCategories(), get().loadCategoryRules()]);
    await get().loadTags();
  },

  createWorkspace: async (name) => {
    const workspace = await invoke('workspace:create', { name });
    set(s => ({ workspaces: [...s.workspaces, workspace] }));
    await get().setActiveWorkspace(workspace.id);
    return workspace;
  },

  renameWorkspace: async (id, name) => {
    const workspace = await invoke('workspace:rename', { id, name });
    set(s => ({ workspaces: s.workspaces.map(w => (w.id === id ? workspace : w)) }));
  },

  deleteWorkspace: async (id) => {
    const { remainingId } = await invoke('workspace:delete', { id });
    set(s => ({ workspaces: s.workspaces.filter(w => w.id !== id) }));
    if (get().activeWorkspaceId === id) {
      // Force a switch even though the id changed underneath us.
      set({ activeWorkspaceId: null });
      await get().setActiveWorkspace(remainingId);
    }
  },
});
