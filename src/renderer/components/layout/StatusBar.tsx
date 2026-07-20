import React from 'react';
import { useStore } from '../../stores';

export function StatusBar() {
  const isSaving = useStore(s => s.isSaving);
  const activeDocument = useStore(s => s.activeDocument);
  const activeSectionId = useStore(s => s.activeSectionId);
  const sections = useStore(s => s.sections);

  const activeSection = sections.find(s => s.id === activeSectionId);

  return (
    <div
      className="status-bar"
      style={{
        height: 'var(--status-bar-height)',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-3)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--text-muted)',
        gap: 'var(--space-4)',
        flexShrink: 0,
      }}
    >
      {activeDocument && (
        <>
          <span>{activeDocument.title}</span>
          {activeSection && (
            <span>
              {activeDocument.sectionLabel}: {activeSection.title}
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            {isSaving ? 'Saving...' : 'Saved'}
          </span>
        </>
      )}
      {!activeDocument && <span>TotoNote</span>}
    </div>
  );
}
