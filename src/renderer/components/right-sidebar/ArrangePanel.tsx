import React, { useState } from 'react';
import { useStore } from '../../stores';

export function ArrangePanel() {
  const sections = useStore(s => s.sections);
  const activeDocument = useStore(s => s.activeDocument);
  const updateDocument = useStore(s => s.updateDocument);
  const reorderSections = useStore(s => s.reorderSections);

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
            <span className="arrange-row__title">{section.title}</span>
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
