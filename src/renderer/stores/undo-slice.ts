import type { StateCreator } from 'zustand';
import type { DeletionSnapshot } from '../../shared/domain-types';
import { invoke } from '../lib/ipc-client';

/** How long an undo stays offered before the toast disappears. */
export const UNDO_WINDOW_MS = 8000;

export interface PendingUndo {
  id: number;
  snapshot: DeletionSnapshot;
  message: string;
}

export interface UndoSlice {
  /** At most one undo is offered at a time — the most recent deletion. */
  pendingUndo: PendingUndo | null;

  offerUndo: (snapshot: DeletionSnapshot) => void;
  dismissUndo: () => void;
  /** Restore the pending deletion, then reload whatever it touched. */
  performUndo: () => Promise<DeletionSnapshot | null>;
}

let undoCounter = 0;

const KIND_LABEL: Record<DeletionSnapshot['kind'], string> = {
  document: 'Document',
  section: 'Section',
  tag: 'Tag',
  category: 'Category',
};

export const createUndoSlice: StateCreator<UndoSlice, [], [], UndoSlice> = (set, get) => ({
  pendingUndo: null,

  offerUndo: (snapshot) => {
    // A snapshot with nothing in it means the delete found nothing to remove.
    const total = Object.values(snapshot.rows).reduce((n, rows) => n + rows.length, 0);
    if (total === 0) return;
    set({
      pendingUndo: {
        id: ++undoCounter,
        snapshot,
        message: `${KIND_LABEL[snapshot.kind]} "${snapshot.label}" deleted`,
      },
    });
  },

  dismissUndo: () => set({ pendingUndo: null }),

  performUndo: async () => {
    const pending = get().pendingUndo;
    if (!pending) return null;
    set({ pendingUndo: null });
    await invoke('undo:restore', { snapshot: pending.snapshot });
    return pending.snapshot;
  },
});
