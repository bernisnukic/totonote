import React from 'react';
import { useStore } from '../../stores';
import { getEditor } from '../../lib/editor-registry';
import { restoreDrawings } from '../../lib/drawing-registry';
import type { Snapshot } from '../../stores/history-slice';
import { confirmDialog } from '../common/ConfirmDialog';

/** "just now" / "3 min ago" — coarse, recomputed each render. */
function relativeTime(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

/**
 * The History tab: a timeline of checkpoints for the section you're editing. Each is a
 * saved state you can click to roll the section back to — and because the whole timeline
 * stays put, you can jump forward again too (unlike plain undo). Session-only.
 */
export function HistoryPanel() {
  const activeSectionId = useStore(s => s.activeSectionId);
  const sections = useStore(s => s.sections);
  const historyBySection = useStore(s => s.historyBySection);
  const currentSnapshotId = useStore(s => s.currentSnapshotId);
  const markCurrentSnapshot = useStore(s => s.markCurrentSnapshot);
  const annotations = useStore(s => s.documentAnnotations);
  const deleteAnnotation = useStore(s => s.deleteAnnotation);
  const batchUpdatePositions = useStore(s => s.batchUpdatePositions);
  const loadAnnotations = useStore(s => s.loadAnnotations);
  const loadDocumentAnnotations = useStore(s => s.loadDocumentAnnotations);
  const activeDocumentId = useStore(s => s.activeDocumentId);

  const activeSection = sections.find(s => s.id === activeSectionId);
  const snapshots = activeSectionId ? historyBySection[activeSectionId] ?? [] : [];
  const currentId = activeSectionId ? currentSnapshotId[activeSectionId] : undefined;

  /**
   * Roll the section back to a checkpoint — text *and* highlights.
   *
   * Restoring text alone corrupts the compiled pages: a highlight's position is measured
   * against the document it was made in, so older text leaves every highlight pointing at
   * whatever now sits at those offsets, and the wiki quietly shows words the user never
   * marked. Each checkpoint records where the highlights were, and they are put back with
   * it. Highlights made *after* the checkpoint have no text to attach to, so they go —
   * which is what "put it back how it was" means, and we say so before doing it.
   */
  const restore = async (snap: Snapshot) => {
    if (!activeSectionId) return;
    const editor = getEditor(activeSectionId);
    if (!editor) return;
    let parsed;
    try {
      parsed = JSON.parse(snap.content);
    } catch {
      return;
    }

    const keptIds = new Set(snap.annotations.map(a => a.id));
    const doomed = annotations.filter(a => a.sectionId === activeSectionId && !keptIds.has(a.id));
    if (doomed.length > 0) {
      const count = `${doomed.length} highlight${doomed.length === 1 ? '' : 's'}`;
      const confirmed = await confirmDialog({
        title: 'Restore this checkpoint?',
        message: `This removes ${count} added since then, because the text they mark no longer exists.`,
        confirmLabel: 'Restore anyway',
        destructive: true,
      });
      if (!confirmed) return;
    }

    // emitUpdate:true so the restore is saved (and, in manual-save mode, marked dirty).
    editor.commands.setContent(parsed, { emitUpdate: true });
    editor.commands.focus();

    for (const annotation of doomed) {
      await deleteAnnotation(annotation.id);
    }
    if (snap.annotations.length > 0) {
      await batchUpdatePositions(
        snap.annotations.map(a => ({ id: a.id, fromPos: a.fromPos, toPos: a.toPos })),
      );
    }
    // Drawings keep their strokes in their own table, so they are restored separately —
    // after setContent, since the nodes have to exist before they can be written to.
    if (snap.drawings.length > 0) {
      requestAnimationFrame(() => restoreDrawings(snap.drawings));
    }

    // Re-read so the decorations redraw at the restored positions.
    await loadAnnotations(activeSectionId);
    if (activeDocumentId) await loadDocumentAnnotations(activeDocumentId);

    markCurrentSnapshot(activeSectionId, snap.id);
  };

  if (!activeSection) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">Open a section to see its history.</p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="info-section">
        <div className="info-section-title">History — {activeSection.title}</div>
        <p className="input-hint" style={{ margin: '0 var(--space-2) var(--space-2)' }}>
          Checkpoints saved as you write. Click one to roll this section back to it — you can
          jump forward again too. History clears when you close the app.
        </p>
      </div>

      {snapshots.length <= 1 ? (
        <div className="empty-state">
          <p className="empty-state-text">Keep writing and checkpoints will appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {[...snapshots].reverse().map((snap, i) => {
            const isCurrent = snap.id === currentId;
            return (
              <button
                key={snap.id}
                className={`history-item${isCurrent ? ' current' : ''}`}
                onClick={() => void restore(snap)}
                disabled={isCurrent}
                title={isCurrent ? 'This is the current state' : 'Restore this state'}
              >
                <span className="history-item-dot" />
                <span className="history-item-body">
                  <span className="history-item-time">
                    {i === 0 ? 'Latest' : relativeTime(snap.at)}
                    {isCurrent ? ' · current' : ''}
                  </span>
                  <span className="history-item-preview">{snap.preview || '(empty)'}</span>
                  <span className="history-item-meta">{snap.chars} chars</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
