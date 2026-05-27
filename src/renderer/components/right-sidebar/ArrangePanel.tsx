import React from 'react';
import { useStore } from '../../stores';

export function ArrangePanel() {
  const sections = useStore(s => s.sections);
  const activeDocument = useStore(s => s.activeDocument);
  const updateDocument = useStore(s => s.updateDocument);
  const reorderSections = useStore(s => s.reorderSections);

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const orderedIds = sections.map(s => s.id);
    [orderedIds[index], orderedIds[newIndex]] = [orderedIds[newIndex], orderedIds[index]];
    reorderSections(orderedIds);
  };

  return (
    <div style={{ padding: 'var(--space-2)' }}>
      {activeDocument && (
        <div className="input-group">
          <label className="input-label">Section Label</label>
          <input
            className="input"
            value={activeDocument.sectionLabel}
            onChange={e => updateDocument(activeDocument.id, { sectionLabel: e.target.value })}
            placeholder="Section"
          />
        </div>
      )}
      <div className="info-section">
        <div className="info-section-title">Sections</div>
        {sections.map((section, i) => (
          <div
            key={section.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-1) var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ flex: 1 }}>{section.title}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveSection(i, 'up')}
              disabled={i === 0}
            >
              &#9650;
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveSection(i, 'down')}
              disabled={i === sections.length - 1}
            >
              &#9660;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
