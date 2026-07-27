/**
 * One undo stack covering both the writing and the tagging.
 *
 * ProseMirror keeps its own history of document changes, and it is the only thing that
 * understands them. Tagging is not a document change at all — a highlight is a row in the
 * database drawn as a decoration — so the editor's history has never known about it.
 *
 * The result was the order the tester described: type, tag, then one Ctrl+Z threw away the
 * text *and* the tag together, because undoing the typing took the text the tag sat on with
 * it. What they expect, and what everything else does, is one step per action:
 *
 *     type → tag → ⌘Z removes the tag → ⌘Z removes the text
 *                → ⌘Y puts the text back → ⌘Y puts the tag back
 *
 * So this keeps a list of *what happened in what order*, per section. Document changes go in
 * as markers — the work is still ProseMirror's, we only record that a step exists — and
 * tagging goes in as a pair of functions that undo and redo it. Undo looks at the top of the
 * list and either calls the editor or replays the pair.
 *
 * The markers are counted from ProseMirror's own undo depth rather than from transactions,
 * because it groups a run of typing into a single undoable step and we must agree with it
 * about how many steps there are.
 */

export interface AnnotationEdit {
  /** Put it back the way it was. */
  undo: () => Promise<void> | void;
  /** Do it again. */
  redo: () => Promise<void> | void;
  /** For debugging and tests — "tag", "untag", "refile". */
  label: string;
}

type Entry = { kind: 'doc' } | ({ kind: 'annotation' } & AnnotationEdit);

interface SectionHistory {
  past: Entry[];
  future: Entry[];
}

const histories = new Map<string, SectionHistory>();

/**
 * True while we are driving the editor's own undo/redo.
 *
 * Those calls change ProseMirror's undo depth just as typing does, so without this the
 * editor's reply to our own redo was recorded as a fresh document step — which cleared the
 * redo branch and threw away the tagging step still waiting in it.
 */
let replaying = false;

export function setReplaying(value: boolean): void {
  replaying = value;
}

function historyFor(sectionId: string): SectionHistory {
  let found = histories.get(sectionId);
  if (!found) {
    found = { past: [], future: [] };
    histories.set(sectionId, found);
  }
  return found;
}

/**
 * Record that the editor gained or lost undoable steps.
 *
 * `delta` is the change in ProseMirror's undo depth since the last call: positive when the
 * user wrote something, negative when they undid it through some other route.
 */
export function noteDocumentSteps(sectionId: string, delta: number): void {
  if (replaying) return;
  const history = historyFor(sectionId);
  if (delta > 0) {
    for (let i = 0; i < delta; i++) history.past.push({ kind: 'doc' });
    // Writing after undoing abandons the redo branch, exactly as a text editor does.
    history.future = [];
  } else if (delta < 0) {
    for (let i = 0; i < -delta && history.past.length > 0; i++) {
      const last = history.past.pop();
      // Only doc markers can be removed this way; an annotation edit sitting on top means
      // the depth changed for some other reason and the marker is deeper down.
      if (last && last.kind !== 'doc') history.past.push(last);
    }
  }
}

/** Record a tagging change, so it gets its own place in the order. */
export function recordAnnotationEdit(sectionId: string, edit: AnnotationEdit): void {
  const history = historyFor(sectionId);
  history.past.push({ kind: 'annotation', ...edit });
  history.future = [];
}

/** What undo would do next: nothing, the editor's own history, or a tagging change. */
export function nextUndo(sectionId: string): 'none' | 'doc' | 'annotation' {
  const top = historyFor(sectionId).past.at(-1);
  return top ? top.kind : 'none';
}

export function nextRedo(sectionId: string): 'none' | 'doc' | 'annotation' {
  const top = historyFor(sectionId).future.at(-1);
  return top ? top.kind : 'none';
}

/**
 * Undo one step.
 *
 * Returns 'doc' when the caller should ask the editor to undo, 'annotation' when this has
 * already been handled here, and 'none' when there is nothing left.
 */
export async function undoOne(sectionId: string): Promise<'none' | 'doc' | 'annotation'> {
  const history = historyFor(sectionId);
  const entry = history.past.pop();
  if (!entry) return 'none';
  history.future.push(entry);
  if (entry.kind === 'annotation') {
    await entry.undo();
    return 'annotation';
  }
  return 'doc';
}

export async function redoOne(sectionId: string): Promise<'none' | 'doc' | 'annotation'> {
  const history = historyFor(sectionId);
  const entry = history.future.pop();
  if (!entry) return 'none';
  history.past.push(entry);
  if (entry.kind === 'annotation') {
    await entry.redo();
    return 'annotation';
  }
  return 'doc';
}

/** Forget a section's history — when it is closed, or its document left. */
export function clearEditHistory(sectionId: string): void {
  histories.delete(sectionId);
}

/** Testing seam. */
export function resetAllEditHistory(): void {
  histories.clear();
}
