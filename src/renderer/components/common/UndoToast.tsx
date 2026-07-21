import React, { useEffect } from 'react';
import { useStore } from '../../stores';
import { UNDO_WINDOW_MS } from '../../stores/undo-slice';

/**
 * Offers a short window to take back the last deletion.
 *
 * Deleting a tag or a category cascades far — every highlight using it, in every
 * document — and none of it used to be recoverable. Rather than putting a confirmation
 * dialog in front of every delete, the delete goes through and this offers to put it
 * back. (Documents still confirm first: that one is big enough to be worth a pause.)
 */
export function UndoToast() {
  const pendingUndo = useStore(s => s.pendingUndo);
  const dismissUndo = useStore(s => s.dismissUndo);
  const performUndo = useStore(s => s.performUndo);
  const loadDocuments = useStore(s => s.loadDocuments);
  const loadSections = useStore(s => s.loadSections);
  const loadCategories = useStore(s => s.loadCategories);
  const loadCategoryRules = useStore(s => s.loadCategoryRules);
  const loadTags = useStore(s => s.loadTags);
  const loadDocumentAnnotations = useStore(s => s.loadDocumentAnnotations);
  const loadSectionTagsByDocument = useStore(s => s.loadSectionTagsByDocument);
  const activeDocumentId = useStore(s => s.activeDocumentId);

  // Expire the offer. Keyed on the pending id so a second deletion restarts the clock.
  useEffect(() => {
    if (!pendingUndo) return;
    const timer = setTimeout(dismissUndo, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [pendingUndo, dismissUndo]);

  if (!pendingUndo) return null;

  const handleUndo = async () => {
    const snapshot = await performUndo();
    if (!snapshot) return;
    // Reload everything the restore could have touched. Cheap next to getting it wrong.
    await Promise.all([
      loadDocuments(),
      loadCategories(),
      loadCategoryRules(),
      loadTags(),
      activeDocumentId ? loadSections(activeDocumentId) : Promise.resolve(),
      activeDocumentId ? loadDocumentAnnotations(activeDocumentId) : Promise.resolve(),
      activeDocumentId ? loadSectionTagsByDocument(activeDocumentId) : Promise.resolve(),
    ]);
  };

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast__text">{pendingUndo.message}</span>
      <button className="undo-toast__btn" onClick={handleUndo}>
        Undo
      </button>
      <button className="undo-toast__close" onClick={dismissUndo} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}
