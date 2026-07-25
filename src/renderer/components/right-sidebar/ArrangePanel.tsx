import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../stores';

export function ArrangePanel() {
  const sections = useStore(s => s.sections);
  const activeDocument = useStore(s => s.activeDocument);
  const updateDocument = useStore(s => s.updateDocument);
  const reorderSections = useStore(s => s.reorderSections);
  const updateSection = useStore(s => s.updateSection);

  // Inline rename, for sections and for the document itself. Both were impossible before —
  // the guide told users to choose titles carefully because they were permanent.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renamingId]);

  const commitRename = () => {
    const id = renamingId;
    const value = renameValue.trim();
    setRenamingId(null);
    if (!id || !value) return;
    if (id === 'document') {
      if (activeDocument && value !== activeDocument.title) updateDocument(activeDocument.id, { title: value });
      return;
    }
    const section = sections.find(s => s.id === id);
    if (section && value !== section.title) updateSection(id, { title: value });
  };

  const renameInput = (
    <input
      ref={renameRef}
      className="input"
      value={renameValue}
      onChange={e => setRenameValue(e.target.value)}
      onBlur={commitRename}
      onKeyDown={e => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenamingId(null);
      }}
    />
  );

  // Drag reordering state.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const orderedIds = sections.map(s => s.id);
    [orderedIds[index], orderedIds[newIndex]] = [orderedIds[newIndex], orderedIds[index]];
    reorderSections(orderedIds);
  };

  /** Drop the dragged section where `targetId` currently sits. */
  const dropOnto = (targetId: string) => {
    const from = sections.findIndex(s => s.id === dragId);
    const to = sections.findIndex(s => s.id === targetId);
    setDragId(null);
    setDropTargetId(null);
    if (from === -1 || to === -1 || from === to) return;
    const orderedIds = sections.map(s => s.id);
    const [moved] = orderedIds.splice(from, 1);
    orderedIds.splice(to, 0, moved);
    reorderSections(orderedIds);
  };

  return (
    <div style={{ padding: 'var(--space-2)' }}>
      {activeDocument && (
        <div className="input-group">
          <label className="input-label">Document</label>
          {renamingId === 'document' ? (
            renameInput
          ) : (
            <div
              className="arrange-row arrange-row--title"
              onClick={() => {
                setRenamingId('document');
                setRenameValue(activeDocument.title);
              }}
              title="Click to rename"
            >
              <span className="arrange-row__title">{activeDocument.title}</span>
            </div>
          )}
        </div>
      )}

      {activeDocument && (
        <div className="input-group">
          <label className="input-label">Section label</label>
          <input
            className="input"
            value={activeDocument.sectionLabel}
            onChange={e => updateDocument(activeDocument.id, { sectionLabel: e.target.value })}
            placeholder="Section"
          />
          <p className="input-hint">
            What this document calls its sections. Change it to <em>Chapter</em>, <em>Act</em>,{' '}
            <em>Entry</em>… and the app uses that word wherever it refers to a section in this
            document.
          </p>
        </div>
      )}
      <div className="info-section">
        <div className="info-section-title">Sections</div>
        {sections.length > 1 && (
          <p className="input-hint" style={{ marginTop: 0 }}>Drag to reorder, or use the arrows.</p>
        )}
        {sections.map((section, i) => (
          <div
            key={section.id}
            className={`arrange-row${dropTargetId === section.id ? ' drop-target' : ''}${
              dragId === section.id ? ' dragging' : ''
            }`}
            draggable={sections.length > 1}
            onDragStart={() => setDragId(section.id)}
            onDragEnd={() => {
              setDragId(null);
              setDropTargetId(null);
            }}
            onDragOver={e => {
              if (!dragId || dragId === section.id) return;
              e.preventDefault();
              setDropTargetId(section.id);
            }}
            onDragLeave={() => setDropTargetId(t => (t === section.id ? null : t))}
            onDrop={e => {
              e.preventDefault();
              dropOnto(section.id);
            }}
          >
            {sections.length > 1 && (
              <span className="arrange-row__grip" aria-hidden>
                &#10247;
              </span>
            )}
            {renamingId === section.id ? (
              renameInput
            ) : (
              <span
                className="arrange-row__title arrange-row__title--editable"
                onClick={() => {
                  setRenamingId(section.id);
                  setRenameValue(section.title);
                }}
                title="Click to rename"
              >
                {section.title}
              </span>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveSection(i, 'up')}
              disabled={i === 0}
              aria-label="Move up"
            >
              &#9650;
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveSection(i, 'down')}
              disabled={i === sections.length - 1}
              aria-label="Move down"
            >
              &#9660;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
