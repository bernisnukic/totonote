import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { useClickOutside } from '../../hooks/useClickOutside';
import { findAdjacentAnnotations } from '../../lib/annotation-utils';
import { Modal } from '../common/Modal';
import { LabelAutocomplete } from '../right-sidebar/LabelAutocomplete';
import { flattenCategoryTree, optionIndent } from '../../lib/category-tree';
import { clickable } from '../../lib/clickable';
import { useMenuPosition } from '../../hooks/useMenuPosition';
import { getEditor } from '../../lib/editor-registry';
import { confirmDialog } from '../common/ConfirmDialog';
import { filingChoices, narrowingHidesSomething } from '../../lib/filing-options';

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
  // Anchored at the pointer, but flipped up or left when that would run off the window.
  const placement = useMenuPosition(ref, contextMenu?.x ?? 0, contextMenu?.y ?? 0);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showCombineMenu, setShowCombineMenu] = useState(false);
  // File-under modal state, captured when the menu item is clicked — the menu (and its
  // annotation id) are gone by the time the modal is interacted with.
  const [fileModalAnnotationId, setFileModalAnnotationId] = useState<string | null>(null);
  const [fileCategoryId, setFileCategoryId] = useState('');
  const [fileShowAll, setFileShowAll] = useState(false);
  // The tag chosen in the Add Tag modal, held until Add is pressed.
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState('');
  const [pendingShowAll, setPendingShowAll] = useState(false);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [setContextMenu]);

  // Escape closes the menu, the same as clicking away from it.
  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A modal opened *from* the menu owns Escape while it is up.
      if (showAddTagModal || fileModalAnnotationId) return;
      setContextMenu(null);
      setShowCombineMenu(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [contextMenu, showAddTagModal, fileModalAnnotationId, setContextMenu]);

  // Filing narrows to the tagged category's own branch — see lib/filing-options.
  const filingAnnotation = annotations.find(a => a.id === fileModalAnnotationId) ?? null;
  const filingTag = filingAnnotation ? tags.find(t => t.id === filingAnnotation.tagId) ?? null : null;

  const handleFileUnder = async (categoryId: string | null) => {
    if (fileModalAnnotationId) {
      await updateAnnotation(fileModalAnnotationId, { categoryId });
    }
    setFileModalAnnotationId(null);
  };

  /**
   * Picking a tag used to create the highlight there and then, which meant there was no
   * moment at which you could also say where to file it — you had to right-click the
   * highlight you had just made. The choice is staged now, and Add commits it.
   */
  const handleAddTagToSelection = async (tagId: string, categoryId: string | null) => {
    if (!activeSectionId || !selectedRange) return;
    await createAnnotation(activeSectionId, tagId, selectedRange.from, selectedRange.to, undefined, categoryId);
    if (activeSectionId) loadAnnotations(activeSectionId);
    closeAddTagModal();
  };

  const closeAddTagModal = () => {
    setShowAddTagModal(false);
    setPendingTagId(null);
    setPendingCategoryId('');
    setPendingShowAll(false);
    setContextMenu(null);
    setShowCombineMenu(false);
  };

  const pendingTag = tags.find(t => t.id === pendingTagId) ?? null;
  const pendingChoices = filingChoices(categories, pendingTag?.categoryId, pendingShowAll);

  const addTagModal = (
    <Modal
      title={contextMenu?.type === 'annotation' ? 'Add Tag' : 'Add Tag to Selection'}
      isOpen={showAddTagModal}
      onClose={closeAddTagModal}
      footer={
        <>
          <button className="btn btn-secondary" onClick={closeAddTagModal}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!pendingTagId}
            onClick={() => pendingTagId && void handleAddTagToSelection(pendingTagId, pendingCategoryId || null)}
          >
            Add
          </button>
        </>
      }
    >
      <LabelAutocomplete
        tags={tags}
        onSelect={tagId => {
          setPendingTagId(tagId);
          // Default the filing to the tag's own category, which is where it belongs
          // more often than not.
          const picked = tags.find(t => t.id === tagId);
          setPendingCategoryId(picked?.categoryId ?? '');
        }}
        placeholder="Search tags..."
      />
      {pendingTag && (
        <>
          <p className="rule-help">
            Tagging as <strong>{pendingTag.name}</strong>. Press Enter to add it.
          </p>
          <div className="input-group">
            <label className="input-label">File under (optional)</label>
            <select
              className="input"
              value={pendingCategoryId}
              onChange={e => setPendingCategoryId(e.target.value)}
            >
              <option value="">&mdash; not filed &mdash;</option>
              {pendingChoices.map(({ category: cat, depth }) => (
                <option key={cat.id} value={cat.id}>{optionIndent(depth)}{cat.name}</option>
              ))}
            </select>
            {narrowingHidesSomething(categories, pendingTag.categoryId) && (
              <label className="settings-toggle settings-toggle--inline">
                <input
                  type="checkbox"
                  checked={pendingShowAll}
                  onChange={e => setPendingShowAll(e.target.checked)}
                />
                <span className="settings-toggle-hint">Show all categories</span>
              </label>
            )}
          </div>
        </>
      )}
    </Modal>
  );

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
          {filingChoices(categories, filingTag?.categoryId, fileShowAll).map(({ category: cat, depth }) => (
            <option key={cat.id} value={cat.id}>{optionIndent(depth)}{cat.name}</option>
          ))}
        </select>
        {narrowingHidesSomething(categories, filingTag?.categoryId) && (
          <label className="settings-toggle settings-toggle--inline">
            <input type="checkbox" checked={fileShowAll} onChange={e => setFileShowAll(e.target.checked)} />
            <span className="settings-toggle-hint">Show all categories</span>
          </label>
        )}
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

  // Both modals are opened *by* a menu item, which also closes the menu — so they must
  // live outside the branch returns below. Rendering them only inside a branch meant
  // "Add tag to selection" appeared to do nothing: the click closed the menu and
  // unmounted the modal in the same tick. It reappeared only on the next right-click.
  if (!contextMenu || contextMenu.type !== 'annotation') {
    if (!contextMenu || contextMenu.type !== 'text-selection') {
      return (
        <>
          {addTagModal}
          {fileModal}
        </>
      );
    }
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

  /** The words a neighbouring highlight covers, for telling two of them apart. */
  const adjacentText = (adj: { sectionId: string; fromPos: number; toPos: number }): string => {
    const editor = getEditor(adj.sectionId);
    if (!editor) return '';
    try {
      const text = editor.state.doc.textBetween(adj.fromPos, adj.toPos, ' ').trim();
      return text.length > 28 ? `${text.slice(0, 28)}…` : text;
    } catch {
      return '';
    }
  };

  const handleCombine = async (adjacentId: string) => {
    const adjacent = annotations.find(a => a.id === adjacentId);
    if (!annotation || !adjacent) return;

    // Combining across two different tags silently retags the neighbour's words. It is
    // in the guide, but nobody reads the guide mid-edit — and undo does not put the tag
    // back, because tagging is not part of the document's own history.
    if (adjacent.tagId !== annotation.tagId) {
      const mine = tags.find(t => t.id === annotation.tagId)?.name ?? 'this tag';
      const theirs = tags.find(t => t.id === adjacent.tagId)?.name ?? 'the other tag';
      const ok = await confirmDialog({
        title: 'Combine highlights with different tags?',
        message: `The text tagged ${theirs} becomes part of this ${mine} highlight.`,
        detail: `It stops being tagged ${theirs}, and undo will not put that back.`,
        confirmLabel: `Combine as ${mine}`,
        destructive: true,
      });
      if (!ok) return;
    }

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

  // Text selection context menu (no active annotation)
  if (contextMenu.type === 'text-selection') {
    return (
      <>
        <div
          ref={ref}
          className="context-menu"
          style={placement}
        >
          <div className="context-menu-item" {...clickable(() => { setShowAddTagModal(true); setContextMenu(null); })}>
            Add tag to selection
          </div>
        </div>
        {addTagModal}
      </>
    );
  }

  // Annotation context menu
  return (
    <>
      <div
        ref={ref}
        className="context-menu"
        style={placement}
      >
        {tag && (
          <div className="context-menu-header">
            <span className="context-menu-color" style={{ backgroundColor: tag.color }} />
            {tag.name}
          </div>
        )}

        <div className="context-menu-item" {...clickable(handleRemove)}>
          Remove annotation
        </div>
        {annotation && (
          <div className="context-menu-item" {...clickable(openFileModal)}>
            File under&hellip;
          </div>
        )}

        {selectedRange && annotation && (
          <>
            <div className="context-menu-separator" />
            <div className="context-menu-item" {...clickable(handleExpandToSelection)}>
              Expand to selection
            </div>
            <div className="context-menu-item" {...clickable(handleShrinkToSelection)}>
              Shrink to selection
            </div>
            <div className="context-menu-item" {...clickable(handleSplit)}>
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
                // Two neighbours carrying the same tag produced two identical rows, with
                // no way to tell which was which. Say which side, and show its words.
                const side = annotation && adj.fromPos < annotation.fromPos ? 'before' : 'after';
                return (
                  <div
                    key={adj.id}
                    className="context-menu-item context-menu-item--combine"
                    {...clickable(() => void handleCombine(adj.id))}
                  >
                    <span>
                      Combine with {adjTag?.name || 'Unknown'} ({side})
                    </span>
                    {adjacentText(adj) && (
                      <span className="context-menu-item__hint">“{adjacentText(adj)}”</span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="context-menu-item" {...clickable(() => setShowCombineMenu(true))}>
                Combine with adjacent...
              </div>
            )}
          </>
        )}

        <div className="context-menu-separator" />
        <div className="context-menu-item" {...clickable(() => { setShowAddTagModal(true); setContextMenu(null); })}>
          Add another tag to selection
        </div>
      </div>

      {addTagModal}
      {fileModal}
    </>
  );
}
