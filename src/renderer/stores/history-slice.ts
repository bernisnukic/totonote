import type { StateCreator } from 'zustand';
import { summarizeDoc } from '../lib/doc-summary';

/** Where one highlight sat at the moment a checkpoint was taken. */
export interface SnapshotAnnotation {
  id: string;
  fromPos: number;
  toPos: number;
}

/** One saved state of a section, for the history timeline. Session-only (not persisted). */
export interface Snapshot {
  id: string;
  /** ISO timestamp the snapshot was captured. */
  at: string;
  /** TipTap JSON string of the section at this point. */
  content: string;
  chars: number;
  preview: string;
  /**
   * Highlight positions at this point.
   *
   * Restoring text without these silently corrupts the wiki: annotation positions are
   * measured against the document they were made in, so putting older text back leaves
   * every highlight pointing at whatever now occupies those offsets. Compiled pages then
   * show text the user never highlighted.
   */
  annotations: SnapshotAnnotation[];
}

/** Keep the timeline bounded — old states drop off the front. */
export const MAX_SNAPSHOTS = 60;

export interface HistorySlice {
  /** Per-section snapshot timeline, oldest first. */
  historyBySection: Record<string, Snapshot[]>;
  /** Which snapshot each section currently sits on ("you are here" in the panel). */
  currentSnapshotId: Record<string, string>;

  /** Record the section's current content as a snapshot (no-op if unchanged). */
  pushSnapshot: (sectionId: string, content: string, annotations?: SnapshotAnnotation[]) => void;
  /** Move the "you are here" marker (used when restoring a past state). */
  markCurrentSnapshot: (sectionId: string, snapshotId: string) => void;
  clearSectionHistory: (sectionId: string) => void;
}

function samePositions(a: SnapshotAnnotation[], b: SnapshotAnnotation[]): boolean {
  if (a.length !== b.length) return false;
  const key = (list: SnapshotAnnotation[]) =>
    list
      .map(x => `${x.id}:${x.fromPos}:${x.toPos}`)
      .sort()
      .join('|');
  return key(a) === key(b);
}

export const createHistorySlice: StateCreator<HistorySlice, [], [], HistorySlice> = (set) => ({
  historyBySection: {},
  currentSnapshotId: {},

  pushSnapshot: (sectionId, content, annotations = []) =>
    set(s => {
      const list = s.historyBySection[sectionId] ?? [];
      const last = list[list.length - 1];
      // A highlight changes the section's state without touching a character of text, so
      // comparing content alone would drop the checkpoint that records it — and a later
      // restore would then have no idea the highlight existed.
      if (last && last.content === content && samePositions(last.annotations, annotations)) return s;
      const { chars, preview } = summarizeDoc(content);
      const snap: Snapshot = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        content,
        chars,
        preview,
        annotations,
      };
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
