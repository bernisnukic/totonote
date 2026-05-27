import React, { useState, useRef } from 'react';
import { useStore } from '../../stores';
import { getActiveEditor } from '../../lib/editor-registry';
import { Modal } from '../common/Modal';
import { LabelAutocomplete } from '../right-sidebar/LabelAutocomplete';
import { ColorPicker } from '../common/ColorPicker';

export function SelectionToolbar() {
  const selectedRange = useStore(s => s.selectedRange);
  const selectionToolbarPos = useStore(s => s.selectionToolbarPos);
  const activeSectionId = useStore(s => s.activeSectionId);
  const createAnnotation = useStore(s => s.createAnnotation);
  const tags = useStore(s => s.tags);
  const categories = useStore(s => s.categories);
  const createTag = useStore(s => s.createTag);
  const loadAnnotations = useStore(s => s.loadAnnotations);
  const [showTagModal, setShowTagModal] = useState(false);

  // Inline tag creation state
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newColor, setNewColor] = useState('#48dbfb');
  const [selectedText, setSelectedText] = useState('');

  const savedRange = useRef<{ from: number; to: number } | null>(null);
  const savedPos = useRef<{ x: number; y: number } | null>(null);

  const handleAnnotate = () => {
    savedRange.current = selectedRange;
    savedPos.current = selectionToolbarPos;

    // Extract selected text for pre-filling tag name (only for short selections)
    const editor = getActiveEditor(activeSectionId);
    if (editor && selectedRange) {
      const text = editor.state.doc.textBetween(selectedRange.from, selectedRange.to, ' ');
      setSelectedText(text.length <= 50 ? text : '');
    } else {
      setSelectedText('');
    }

    setCreatingTag(false);
    setShowTagModal(true);
  };

  const handleSelectTag = async (tagId: string) => {
    const range = savedRange.current;
    if (!activeSectionId || !range) return;
    await createAnnotation(activeSectionId, tagId, range.from, range.to);
    setShowTagModal(false);
    savedRange.current = null;
    loadAnnotations(activeSectionId);
  };

  const handleCreateNew = (name: string) => {
    setNewTagName(name);
    setNewCategoryId(categories[0]?.id || '');
    setNewColor('#48dbfb');
    setCreatingTag(true);
  };

  const handleCreateAndTag = async () => {
    if (!newTagName.trim() || !newCategoryId) return;
    const tag = await createTag(newCategoryId, newTagName.trim(), newColor);
    await handleSelectTag(tag.id);
  };

  const handleClose = () => {
    setShowTagModal(false);
    setCreatingTag(false);
  };

  const editor = getActiveEditor(activeSectionId);
  const showToolbar = editor && selectedRange && selectionToolbarPos && !showTagModal;

  return (
    <>
      {showToolbar && (
        <div
          className="selection-toolbar"
          style={{
            left: selectionToolbarPos.x,
            top: selectionToolbarPos.y,
            position: 'fixed',
          }}
          onMouseDown={e => e.preventDefault()}
        >
          <button className="selection-toolbar-btn" onClick={handleAnnotate}>
            Tag
          </button>
          <div className="selection-toolbar-separator" />
          <button
            className="selection-toolbar-btn"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            className="selection-toolbar-btn"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            className="selection-toolbar-btn"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            U
          </button>
        </div>
      )}

      <Modal
        title={creatingTag ? 'Create New Tag' : 'Add Tag to Selection'}
        isOpen={showTagModal}
        onClose={handleClose}
      >
        {creatingTag ? (
          <div>
            <div className="input-group">
              <label className="input-label">Name</label>
              <input
                className="input"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label className="input-label">Category</label>
              <select
                className="input"
                value={newCategoryId}
                onChange={e => setNewCategoryId(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Color</label>
              <ColorPicker selectedColor={newColor} onSelect={setNewColor} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <button className="btn btn-primary btn-sm" onClick={handleCreateAndTag}>
                Create &amp; Tag
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCreatingTag(false)}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <LabelAutocomplete
            tags={tags}
            onSelect={handleSelectTag}
            placeholder="Search tags..."
            onCreateNew={handleCreateNew}
            initialQuery={selectedText}
          />
        )}
      </Modal>
    </>
  );
}
