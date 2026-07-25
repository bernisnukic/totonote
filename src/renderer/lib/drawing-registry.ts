/**
 * The drawings currently mounted in the editor, by id.
 *
 * A drawing's strokes live in their own table, not in the section's content, so the History
 * timeline could not see them: rolling a section back left every drawing at its latest
 * state, which made the timeline quietly wrong about what it restored. Each mounted
 * drawing registers here so a checkpoint can read its strokes and a restore can write them
 * back — the same shape as editor-registry and save-registry.
 */
export interface DrawingHandle {
  /** Serialised strokes as they are right now. */
  read: () => string;
  /** Replace the strokes, redrawing and persisting. */
  restore: (strokes: string) => void;
}

const drawings = new Map<string, DrawingHandle>();

export function registerDrawing(drawingId: string, handle: DrawingHandle): void {
  drawings.set(drawingId, handle);
}

export function unregisterDrawing(drawingId: string): void {
  drawings.delete(drawingId);
}

/** Strokes for every mounted drawing among `ids`; ones not mounted are simply absent. */
export function readDrawings(ids: string[]): Array<{ id: string; strokes: string }> {
  const out: Array<{ id: string; strokes: string }> = [];
  for (const id of ids) {
    const handle = drawings.get(id);
    if (handle) out.push({ id, strokes: handle.read() });
  }
  return out;
}

/** Put strokes back. A drawing that is no longer mounted is skipped rather than failing. */
export function restoreDrawings(states: Array<{ id: string; strokes: string }>): void {
  for (const state of states) drawings.get(state.id)?.restore(state.strokes);
}
