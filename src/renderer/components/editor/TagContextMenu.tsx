import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { useClickOutside } from '../../hooks/useClickOutside';
import { findAdjacentAnnotations } from '../../lib/annotation-utils';
import { Modal } from '../common/Modal';
import { LabelAutocomplete } from '../right-sidebar/LabelAutocomplete';
import { flattenCategoryTree, optionIndent } from '../../lib/category-tree';

export function TagContextMenu() {
  const contextMenu = useStore(s => s.contextMenu);
  const setContextMenu = useStore(s => s.setContextMenu);
  const deleteAnnotation = useStore(s => s.deleteAnnotation);
  const updateAnnotation = useStore(s => s.updateAnnotation);
  const createAnnotation = useStore(s => s.createAnnotation);
  const activeAnnotationId = useStore(s => s.activeAnnotationId);
  const activeSectionId = useStore(s => s.activeSectionId);
  const annotations = useStore(s => s.annotations);
  const tags = useStore(s => s.tags);
  const selectedRange = useStore(s => s.selectedRange);
  const loadAnnotations = useStore(s => s.loadAnnotations);
  const categories = useStore(s => s.categories);
  const ref = useClickOutside<HTMLDivElement>(() => setContextMenu(null));
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showCombineMenu, setShowCombineMenu] = useState(false);
  // File-under modal state, captured when the menu item is clicked — the menu (and its
  // annotation id) are gone by the time the modal is interacted with.
  const [fileModalAnnotationId, setFileModalAnnotationId] = useState<string | null>(null);
  const [fileCategoryId, setFileCategoryId] = useState('');

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [setContextMenu]);

  const flatCategories = flattenCategoryTree(categories);

  const handleFileUnder = async (categoryId: string | null) => {
    if (fileModalAnnotationId) {
      await updateAnnotation(fileModalAnnotationId, { categoryId });
    }
    setFileModalAnnotationId(null);
  };

  const fileModal = fileModalAnnotationId ? (
    <Modal title="File under" isOpen onClose={() => setFileModalAnnotationId(null)}>
      <p className="rule-help">
        Choose which page this excerpt is filed on. It stays highlighted in the text
        either way.
      </p>
      <div className="input-group">
        <label className="input-label">Category</label>
        <select
          className="input"
          value={fileCategoryId}
          onChange={e => setFileCategoryId(e.target.value)}
          autoFocus
        >
          <option value="">&mdash; not filed &mdash;</option>
          {flatCategories.map(({ category: cat, depth }) => (
            <option key={cat.id} value={cat.id}>{optionIndent(depth)}{cat.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <button className="btn btn-primary btn-sm" onClick={() => handleFileUnder(fileCategoryId || null)}>
          Save
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setFileModalAnnotationId(null)}>
          Cancel
        </button>
      </div>
    </Modal>
  ) : null;

  if (!contextMenu || contextMenu.type !== 'annotation') {
    // Check for text-selection context menu
    if (!contextMenu || contextMenu.type !== 'text-selection') return fileModal;
  }

  // Read the target from the menu's own state, not from activeAnnotationId — see the
  // comment on contextMenu in ui-slice.ts for why that field is gone by the time a
  // menu item is clicked.
  const targetAnnotationId = contextMenu?.annotationId ?? activeAnnotationId;
  const annotation = annotations.find(a => a.id === targetAnnotationId);
  const tag = annotation ? tags.find(t => t.id === annotation.tagId) : null;
  const adjacentAnnotations = annotation
    ? findAdjacentAnnotations(annotations, annotation.id, 2)
    : [];

  const closeMenu = () => {
    setContextMenu(null);
    setShowCombineMenu(false);
  };

  const handleRemove = () => {
    if (targetAnnotationId) {
      deleteAnnotation(targetAnnotationId);
    }
    closeMenu();
  };

  const handleExpandToSelection = () => {
    if (!annotation || !selectedRange) return;
    const newFrom = Math.min(annotation.fromPos, selectedRange.from);
    const newTo = Math.max(annotation.toPos, selectedRange.to);
    updateAnnotation(annotation.id, { fromPos: newFrom, toPos: newTo });
    closeMenu();
  };

  const handleShrinkToSelection = () => {
    if (!annotation || !selectedRange) return;
    // Shrink the annotation to only the selected portion
    const newFrom = Math.max(annotation.fromPos, selectedRange.from);
    const newTo = Math.min(annotation.toPos, selectedRange.to);
    if (newFrom < newTo) {
      updateAnnotation(annotation.id, { fromPos: newFrom, toPos: newTo });
    }
    closeMenu();
  };

  const handleSplit = () => {
    if (!annotation || !selectedRange || !activeSectionId) return;
    // Split: remove selected portion, creating up to two annotations
    const { from, to } = selectedRange;
    const leftFrom = annotation.fromPos;
    const leftTo = from;
    const rightFrom = to;
    const rightTo = annotation.toPos;

    deleteAnnotation(annotation.id);

    if (leftFrom < leftTo) {
      createAnnotation(activeSectionId, annotation.tagId, leftFrom, leftTo, annotation.note);
    }
    if (rightFrom < rightTo) {
      createAnnotation(activeSectionId, annotation.tagId, rightFrom, rightTo, annotation.note);
    }

    if (activeSectionId) loadAnnotations(activeSectionId);
    closeMenu();
  };

  const handleCombine = (adjacentId: string) => {
    const adjacent = annotations.find(a => a.id === adjacentId);
    if (!annotation || !adjacent) return;
    // Merge: extend current annotation to cover adjacent, then delete adjacent
    const newFrom = Math.min(annotation.fromPos, adjacent.fromPos);
    const newTo = Math.max(annotation.toPos, adjacent.toPos);
    updateAnnotation(annotation.id, { fromPos: newFrom, toPos: newTo });
    deleteAnnotation(adjacentId);
    closeMenu();
  };

  const openFileModal = () => {
    if (!annotation) return;
    setFileModalAnnotationId(annotation.id);
    setFileCategoryId(annotation.categoryId ?? '');
    closeMenu();
  };

  const handleAddTagToSelection = async (tagId: string) => {
    if (!activeSectionId || !selectedRange) return;
    await createAnnotation(activeSectionId, tagId, selectedRange.from, selectedRange.to);
    if (activeSectionId) loadAnnotations(activeSectionId);
    setShowAddTagModal(false);
    closeMenu();
  };

  // Text selection context menu (no active annotation)
  if (contextMenu.type === 'text-selection') {
    return (
      <>
        <div
          ref={ref}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={() => { setShowAddTagModal(true); setContextMenu(null); }}>
            Add tag to selection
          </div>
        </div>
        <Modal
          title="Add Tag to Selection"
          isOpen={showAddTagModal}
          onClose={() => setShowAddTagModal(false)}
        >
          <LabelAutocomplete
            tags={tags}
            onSelect={handleAddTagToSelection}
            placeholder="Search tags..."
          />
        </Modal>
      </>
    );
  }

  // Annotation context menu
  return (
    <>
      <div
        ref={ref}
        className="context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {tag && (
          <div className="context-menu-header">
            <span className="context-menu-color" style={{ backgroundColor: tag.color }} />
            {tag.name}
          </div>
        )}

        <div className="context-menu-item" onClick={handleRemove}>
          Remove annotation
        </div>
        {annotation && (
          <div className="context-menu-item" onClick={openFileModal}>
            File under&hellip;
          </div>
        )}

        {selectedRange && annotation && (
          <>
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={handleExpandToSelection}>
              Expand to selection
            </div>
            <div className="context-menu-item" onClick={handleShrinkToSelection}>
              Shrink to selection
            </div>
            <div className="context-menu-item" onClick={handleSplit}>
              Split at selection
            </div>
          </>
        )}

        {adjacentAnnotations.length > 0 && (
          <>
            <div className="context-menu-separator" />
            {showCombineMenu ? (
              adjacentAnnotations.map(adj => {
                const adjTag = tags.find(t => t.id === adj.tagId);
                return (
                  <div
                    key={adj.id}
                    className="context-menu-item"
                    onClick={() => handleCombine(adj.id)}
                  >
                    Combine with: {adjTag?.name || 'Unknown'}
                  </div>
                );
              })
            ) : (
              <div className="context-menu-item" onClick={() => setShowCombineMenu(true)}>
                Combine with adjacent...
              </div>
            )}
          </>
        )}

        <div className="context-menu-separator" />
        <div className="context-menu-item" onClick={() => { setShowAddTagModal(true); setContextMenu(null); }}>
          Add another tag to selection
        </div>
      </div>

      <Modal
        title="Add Tag"
        isOpen={showAddTagModal}
        onClose={() => setShowAddTagModal(false)}
      >
        <LabelAutocomplete
          tags={tags}
          onSelect={handleAddTagToSelection}
          placeholder="Search tags..."
        />
      </Modal>
    </>
  );
}
