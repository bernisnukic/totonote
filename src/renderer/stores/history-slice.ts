import type { StateCreator } from 'zustand';
import { summarizeDoc } from '../lib/doc-summary';
import { describeChange } from '../lib/history-diff';

/** Where one highlight sat at the moment a checkpoint was taken. */
export interface SnapshotAnnotation {
  id: string;
  fromPos: number;
  toPos: number;
}

/** A drawing's strokes at the moment a checkpoint was taken. */
export interface SnapshotDrawing {
  id: string;
  strokes: string;
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
   * What changed since the checkpoint before — "Added “hello”", "Removed a drawing".
   *
   * Worked out once, here, rather than in the panel: the previous checkpoint is to hand at
   * this point and the answer never changes afterwards.
   */
  change: string;
  /**
   * Highlight positions at this point.
   *
   * Restoring text without these silently corrupts the wiki: annotation positions are
   * measured against the document they were made in, so putting older text back leaves
   * every highlight pointing at whatever now occupies those offsets. Compiled pages then
   * show text the user never highlighted.
   */
  annotations: SnapshotAnnotation[];
  /**
   * Strokes of any drawings in the section.
   *
   * They live in their own table rather than in the content, so without capturing them a
   * rollback would restore the words and leave every drawing at its latest state.
   */
  drawings: SnapshotDrawing[];
}

/** Keep the timeline bounded — old states drop off the front. */
export const MAX_SNAPSHOTS = 60;

export interface HistorySlice {
  /** Per-section snapshot timeline, oldest first. */
  historyBySection: Record<string, Snapshot[]>;
  /** Which snapshot each section currently sits on ("you are here" in the panel). */
  currentSnapshotId: Record<string, string>;

  /** Record the section's current content as a snapshot (no-op if unchanged). */
  pushSnapshot: (
    sectionId: string,
    content: string,
    annotations?: SnapshotAnnotation[],
    drawings?: SnapshotDrawing[],
  ) => void;
  /** Move the "you are here" marker (used when restoring a past state). */
  markCurrentSnapshot: (sectionId: string, snapshotId: string) => void;
  clearSectionHistory: (sectionId: string) => void;
}

/**
 * Reuse the previous checkpoint's drawing objects wherever the strokes are unchanged.
 *
 * The canvas hands back a freshly serialised string every time it is read, so a section
 * with a drawing in it used to store a complete copy of that drawing in all 60
 * checkpoints — even while the user was only typing and had not touched it. Measured on a
 * 120-stroke drawing that is 10.4 MB per section, against 0.6 MB once the identical
 * strokes share one string.
 */
export function shareUnchangedStrokes(
  previous: SnapshotDrawing[],
  next: SnapshotDrawing[],
): SnapshotDrawing[] {
  if (previous.length === 0) return next;
  const before = new Map(previous.map(d => [d.id, d]));
  return next.map(d => {
    const was = before.get(d.id);
    // Same content, so hand back the *same object* — one string, referenced 60 times.
    return was && was.strokes === d.strokes ? was : d;
  });
}

function sameDrawings(a: SnapshotDrawing[], b: SnapshotDrawing[]): boolean {
  if (a.length !== b.length) return false;
  const key = (list: SnapshotDrawing[]) =>
    list.map(x => `${x.id}:${x.strokes}`).sort().join('|');
  return key(a) === key(b);
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

  pushSnapshot: (sectionId, content, annotations = [], drawings = []) =>
    set(s => {
      const list = s.historyBySection[sectionId] ?? [];
      const last = list[list.length - 1];
      // A highlight changes the section's state without touching a character of text, so
      // comparing content alone would drop the checkpoint that records it — and a later
      // restore would then have no idea the highlight existed.
      if (
        last &&
        last.content === content &&
        samePositions(last.annotations, annotations) &&
        sameDrawings(last.drawings, drawings)
      ) {
        return s;
      }
      const { chars, preview } = summarizeDoc(content);
      const snap: Snapshot = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        content,
        chars,
        preview,
        change: describeChange(last ?? null, { content, annotations, drawings }),
        annotations,
        drawings: last ? shareUnchangedStrokes(last.drawings, drawings) : drawings,
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
