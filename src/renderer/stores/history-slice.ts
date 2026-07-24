import type { StateCreator } from 'zustand';
import { summarizeDoc } from '../lib/doc-summary';

/** One saved state of a section, for the history timeline. Session-only (not persisted). */
export interface Snapshot {
  id: string;
  /** ISO timestamp the snapshot was captured. */
  at: string;
  /** TipTap JSON string of the section at this point. */
  content: string;
  chars: number;
  preview: string;
}

/** Keep the timeline bounded — old states drop off the front. */
export const MAX_SNAPSHOTS = 60;

export interface HistorySlice {
  /** Per-section snapshot timeline, oldest first. */
  historyBySection: Record<string, Snapshot[]>;
  /** Which snapshot each section currently sits on ("you are here" in the panel). */
  currentSnapshotId: Record<string, string>;

  /** Record the section's current content as a snapshot (no-op if unchanged). */
  pushSnapshot: (sectionId: string, content: string) => void;
  /** Move the "you are here" marker (used when restoring a past state). */
  markCurrentSnapshot: (sectionId: string, snapshotId: string) => void;
  clearSectionHistory: (sectionId: string) => void;
}

export const createHistorySlice: StateCreator<HistorySlice, [], [], HistorySlice> = (set) => ({
  historyBySection: {},
  currentSnapshotId: {},

  pushSnapshot: (sectionId, content) =>
    set(s => {
      const list = s.historyBySection[sectionId] ?? [];
      const last = list[list.length - 1];
      if (last && last.content === content) return s; // unchanged → nothing to record
      const { chars, preview } = summarizeDoc(content);
      const snap: Snapshot = { id: crypto.randomUUID(), at: new Date().toISOString(), content, chars, preview };
      const next = [...list, snap].slice(-MAX_SNAPSHOTS);
      return {
        historyBySection: { ...s.historyBySection, [sectionId]: next },
        currentSnapshotId: { ...s.currentSnapshotId, [sectionId]: snap.id },
      };
    }),

  markCurrentSnapshot: (sectionId, snapshotId) =>
    set(s => ({ currentSnapshotId: { ...s.currentSnapshotId, [sectionId]: snapshotId } })),

  clearSectionHistory: (sectionId) =>
    set(s => {
      if (!(sectionId in s.historyBySection) && !(sectionId in s.currentSnapshotId)) return s;
      const historyBySection = { ...s.historyBySection };
      const currentSnapshotId = { ...s.currentSnapshotId };
      delete historyBySection[sectionId];
      delete currentSnapshotId[sectionId];
      return { historyBySection, currentSnapshotId };
    }),
});
